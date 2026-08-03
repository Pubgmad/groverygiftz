import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Product from '@/models/Product';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import slugify from 'slugify';

function productLookup(segment) {
  if (typeof segment === 'string' && /^[a-fA-F0-9]{24}$/.test(segment)) {
    return { _id: segment };
  }
  return { slug: segment };
}

export async function GET(req, { params }) {
  const { slug: segment } = await params;
  await dbConnect();
  const product = await Product.findOne(productLookup(segment)).populate('collections').lean();
  if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(product);
}

export async function PUT(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.type !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { slug: segment } = await params;
  await dbConnect();
  const body = await req.json();
  if (body.title) body.slug = slugify(body.title, { lower: true, strict: true });

  const product = await Product.findOneAndUpdate(productLookup(segment), body, { new: true });
  if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(product);
}

export async function DELETE(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.type !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { slug: segment } = await params;
  await dbConnect();
  const deleted = await Product.findOneAndDelete(productLookup(segment));
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ success: true });
}
