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
import { hydrateProductShippingTemplates } from '@/lib/shippingTemplateHydration';
import { centralizeProductDeliveryEstimates } from '@/lib/centralDeliveryEstimates';
import { readDeliveryEstimateSettings } from '@/lib/deliveryEstimateSettings';
import { buildProductTextFilter, findProductsForSearch, normalizeProductSearchQuery } from '@/lib/productSearch';

export async function GET(req) {
  await dbConnect();
  const { searchParams } = new URL(req?.url || 'http://localhost', 'http://localhost');
  const session = await getServerSession(authOptions);
  const access = await getRequestAdminAccess(session);
  const page = Number(searchParams.get('page')) || 1;
  const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 20, 1), 100);
  const search = normalizeProductSearchQuery(searchParams.get('search') || '');
  const collection = searchParams.get('collection');
  const featured = searchParams.get('featured');
  const bestSeller = searchParams.get('bestSeller');
  const offer = searchParams.get('offer');
  const latest = searchParams.get('latest');
  const includeAll = searchParams.get('all') === 'true';
  const activeOnly = !includeAll || !can(access, 'products', 'read');

  // Suggestion / storefront search path: ranked matches without loading the whole catalog.
  if (search && !collection && featured !== 'true' && bestSeller !== 'true' && offer !== 'true' && latest !== 'true') {
    const result = await findProductsForSearch(Product, search, { limit, activeOnly });
    await hydrateProductShippingTemplates(result.products);
    return NextResponse.json({
      products: result.products,
      total: result.products.length,
      pages: 1,
      page: 1,
    }, { headers: { 'Cache-Control': 'no-store' } });
  }

  const filter = {};
  if (search) {
    const built = buildProductTextFilter(search, { activeOnly: false });
    if (built.filter?.$or) filter.$or = built.filter.$or;
  }
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
  if (activeOnly) filter.isActive = true;

  const [products, total] = await Promise.all([
    Product.find(filter).populate('collections', 'name slug').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Product.countDocuments(filter),
  ]);

  await hydrateProductShippingTemplates(products);

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
