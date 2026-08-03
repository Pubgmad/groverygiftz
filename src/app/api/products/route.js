import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import dbConnect from '@/lib/db';
import Product from '@/models/Product';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import slugify from 'slugify';

export async function GET(req) {
  await dbConnect();
  const { searchParams } = new URL(req.url);
  const session = await getServerSession(authOptions);
  const page = Number(searchParams.get('page')) || 1;
  const limit = Number(searchParams.get('limit')) || 20;
  const search = searchParams.get('search') || '';
  const collection = searchParams.get('collection');
  const featured = searchParams.get('featured');
  const includeAll = searchParams.get('all') === 'true';

  const filter = {};
  if (search) filter.title = { $regex: search, $options: 'i' };
  if (collection) filter.collections = collection;
  if (featured === 'true') filter.isFeatured = true;
  // Expose inactive products only to authenticated admins.
  if (!includeAll || !session || session.user.type !== 'admin') filter.isActive = true;

  const [products, total] = await Promise.all([
    Product.find(filter).populate('collections', 'name slug').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Product.countDocuments(filter),
  ]);

  return NextResponse.json({ products, total, pages: Math.ceil(total / limit), page });
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.type !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();
  const body = await req.json();
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
