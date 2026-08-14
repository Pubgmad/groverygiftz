export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import dbConnect from '@/lib/db';
import Settings from '@/models/Settings';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getCashfreeConfig } from '@/lib/cashfreeConfig';

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
      tamilNaduDeliveryEstimate: 'Within 8 days',
      otherStateDeliveryEstimate: '10-15 days',
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
      googleReviewsEnabled: false,
      googleReviewsSerpApiKey: '',
      googleReviewsPlaceId: '',
      googleReviewsDataId: '',
      googleReviewsSortBy: 'newestFirst',
      googleReviewsCacheHours: 12,
    });
    settings = created.toObject();
  }

  if (!session || session.user.type !== 'admin') {
    return NextResponse.json(sanitizePublicSettings(settings));
  }
  return NextResponse.json(settings);
}

export async function PUT(req) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.type !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();
  const body = await req.json();
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
