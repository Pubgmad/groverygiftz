export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import dbConnect from '@/lib/db';
import Settings from '@/models/Settings';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { can, getRequestAdminAccess } from '@/lib/adminAccess';
import { GIFT_RECOMMENDER_SETTING_KEYS } from '@/lib/adminPermissions';
import { getCashfreeConfig } from '@/lib/cashfreeConfig';
import { DEFAULT_DELIVERY_ESTIMATES, DELIVERY_ESTIMATE_KEYS, withDeliveryEstimateDefaults } from '@/lib/centralDeliveryEstimates';

const GOOGLE_REVIEW_SETTING_KEYS = [
  'googleReviewsEnabled',
  'googleReviewsSerpApiKey',
  'googleReviewsPlaceId',
  'googleReviewsDataId',
  'googleReviewsSortBy',
  'googleReviewsCacheHours',
];

function sanitizePublicSettings(settings) {
  const publicSettings = { ...settings };
  const cashfree = getCashfreeConfig(settings);
  publicSettings.cashfreeEnabled = cashfree.enabled;
  publicSettings.cashfreeEnvironment = cashfree.environment;
  publicSettings.cashfreeSecretKey = '';
  publicSettings.metaPixelTestEventCode = '';
  publicSettings.metaConversionApiAccessToken = '';
  publicSettings.googleReviewsSerpApiKey = '';
  return publicSettings;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  await dbConnect();
  let settings = await Settings.findOne().lean();
  if (!settings) {
    const created = await Settings.create({
      siteName: 'GroveryGiftz',
      tagline: 'Your One-Stop Gift Shop',
      announcementText: 'Tamil Nadu delivery free | Pan India delivery available',
      phone: '+91 99945 49781',
      email: 'Groverygiftz@gmail.com',
      whatsapp: '919994549781',
      address: '126, 3rd St, V.C.K.N.Layout, Sivananda Colony, Tatabad, Coimbatore, Tamil Nadu 641012',
      timings: '11 am to 7 pm',
      freeShippingThreshold: 499,
      shippingCost: 40,
      tamilNaduShippingCost: 0,
      otherStateShippingCost: 120,
      ...DEFAULT_DELIVERY_ESTIMATES,
      deliveryHolidays: [],
      socialLinks: { instagram: 'https://www.instagram.com/groverygiftz?igsh=dGNpbHlybWI0cjNy', youtube: '' },
      promoEnabled: true,
      promoTitle: 'Limited Time Offer!',
      promoSubtitle: "Hurry! Sale ends soon. Don't miss out on amazing deals.",
      promoButtonText: 'Shop Now',
      promoButtonLink: '/shop',
      promoEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      gstNumber: '33KVUPS5560J1ZL',
      tradeName: 'GroveryGiftz',
      metaPixelEnabled: false,
      metaPixelId: '',
      metaPixelTestEventCode: '',
      metaConversionApiEnabled: false,
      metaConversionApiAccessToken: '',
      googleReviewsEnabled: false,
      googleReviewsSerpApiKey: '',
      googleReviewsPlaceId: '',
      googleReviewsDataId: '',
      googleReviewsSortBy: 'newestFirst',
      googleReviewsCacheHours: 12,
    });
    settings = created.toObject();
  }

  const access = await getRequestAdminAccess(session);
  if (can(access, 'settings', 'read')) {
    return NextResponse.json(withDeliveryEstimateDefaults(settings), { headers: { 'Cache-Control': 'no-store' } });
  }
  const publicSettings = sanitizePublicSettings(withDeliveryEstimateDefaults(settings));
  if (can(access, 'gift-recommender', 'read')) {
    GIFT_RECOMMENDER_SETTING_KEYS.forEach((key) => { publicSettings[key] = settings[key]; });
  }
  return NextResponse.json(publicSettings, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PUT(req) {
  const session = await getServerSession(authOptions);
  const access = await getRequestAdminAccess(session);
  if (!session || session.user.type !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const canWriteSettings = can(access, 'settings', 'write');
  const canWriteGift = can(access, 'gift-recommender', 'write');
  if (!canWriteSettings && !canWriteGift) {
    return NextResponse.json({ error: 'You do not have permission to perform this action' }, { status: 403 });
  }

  await dbConnect();
  const body = await req.json();
  if (!canWriteSettings && canWriteGift) {
    const allowed = {};
    GIFT_RECOMMENDER_SETTING_KEYS.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(body, key)) allowed[key] = body[key];
    });
    const settings = await Settings.findOneAndUpdate({}, allowed, { new: true, upsert: true });
    revalidatePath('/', 'layout');
    revalidatePath('/');
    return NextResponse.json(settings);
  }
  // The dedicated two-field endpoint is the only writer of delivery durations.
  DELIVERY_ESTIMATE_KEYS.forEach((key) => { delete body[key]; });
  if (Object.prototype.hasOwnProperty.call(body, 'deliveryHolidays')) {
    if (!Array.isArray(body.deliveryHolidays)) delete body.deliveryHolidays;
    else {
      body.deliveryHolidays = body.deliveryHolidays.map((item) => {
        if (typeof item === 'string') {
          const [datePart, ...nameParts] = item.trim().split('|');
          const date = String(datePart || '').trim();
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
          const name = nameParts.join('|').trim();
          return name ? { date, name } : date;
        }
        if (item && typeof item === 'object') {
          const date = String(item.date || item.value || item.day || '').trim();
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
          const name = String(item.name || item.description || item.label || '').trim();
          return name ? { date, name } : date;
        }
        return null;
      }).filter(Boolean);
    }
  }
  if (GOOGLE_REVIEW_SETTING_KEYS.some((key) => Object.prototype.hasOwnProperty.call(body, key))) {
    body.googleReviewsCache = null;
    body.googleReviewsCacheFetchedAt = null;
    body.googleReviewsCacheSignature = '';
  }
  const settings = await Settings.findOneAndUpdate({}, body, { new: true, upsert: true });
  revalidatePath('/', 'layout');
  revalidatePath('/');
  return NextResponse.json(settings);
}
