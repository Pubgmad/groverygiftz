export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import dbConnect from '@/lib/db';
import Product from '@/models/Product';
import Collection from '@/models/Collection';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { can, getRequestAdminAccess, requireAdminPermission } from '@/lib/adminAccess';
import slugify from 'slugify';
import { activeAdminOfferMatch } from '@/lib/offers';
import { sanitizeProductPayload } from '@/lib/productPayload';
import { centralizeProductDeliveryEstimates } from '@/lib/centralDeliveryEstimates';
import { readDeliveryEstimateSettings } from '@/lib/deliveryEstimateSettings';
import { PRODUCT_CARD_SELECT } from '@/lib/productCardFields';

const ADMIN_LIST_FIELDS = [
  'title', 'slug', 'images', 'regularPrice', 'salePrice', 'stock', 'variants',
  'isActive', 'isOffer', 'offerStartsAt', 'offerEndsAt', 'isFeatured', 'isBestSeller',
  'isQuoteOnly', 'collections', 'customizationPreview.enabled',
].join(' ');

export async function GET(req) {
  await dbConnect();
  const { searchParams } = new URL(req?.url || 'http://localhost', 'http://localhost');
  const page = Number(searchParams.get('page')) || 1;
  const limit = Number(searchParams.get('limit')) || 20;
  const search = searchParams.get('search') || '';
  const collection = searchParams.get('collection');
  const featured = searchParams.get('featured');
  const bestSeller = searchParams.get('bestSeller');
  const offer = searchParams.get('offer');
  const latest = searchParams.get('latest');
  const includeAll = searchParams.get('all') === 'true';

  let session = null;
  let access = { ok: false };
  if (includeAll) {
    session = await getServerSession(authOptions);
    access = await getRequestAdminAccess(session);
  }

  const filter = {};
  if (search) filter.title = { $regex: search, $options: 'i' };
  if (collection) filter.collections = collection;
  if (featured === 'true') filter.isFeatured = true;
  if (bestSeller === 'true') filter.isBestSeller = true;
  if (offer === 'true') Object.assign(filter, activeAdminOfferMatch(new Date()));
  if (latest === 'true') {
    const latestSince = new Date();
    latestSince.setMonth(latestSince.getMonth() - 3);
    filter.createdAt = { $gte: latestSince };
  }
  // Expose inactive products only to authenticated admins.
  if (!includeAll || !can(access, 'products', 'read')) filter.isActive = true;

  let query = Product.find(filter).populate('collections', 'name slug').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit);
  query = query.select(includeAll ? ADMIN_LIST_FIELDS : PRODUCT_CARD_SELECT);
  const [products, total] = await Promise.all([
    query.lean(),
    Product.countDocuments(filter),
  ]);

  return NextResponse.json({ products, total, pages: Math.ceil(total / limit), page }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req) {
  const { error } = await requireAdminPermission('products', 'write');
  if (error) return error;

  await dbConnect();
  const body = sanitizeProductPayload(await req.json());
  centralizeProductDeliveryEstimates(body, await readDeliveryEstimateSettings());
  body.slug = slugify(body.title, { lower: true, strict: true });

  const existing = await Product.findOne({ slug: body.slug });
  if (existing) body.slug += '-' + Date.now().toString(36);

  const product = await Product.create(body);
  revalidatePath('/', 'layout');
  revalidatePath('/');
  revalidatePath('/shop');
  revalidatePath(`/products/${product.slug}`);
  return NextResponse.json(product, { status: 201 });
}
