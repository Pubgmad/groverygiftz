import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Product from '@/models/Product';
import Review from '@/models/Review';

// GET /api/products/[slug]/reviews
export async function GET(request, { params }) {
  await dbConnect();
  const { slug } = await params;
  const product = await Product.findOne({ slug }).select('_id').lean();
  if (!product) return NextResponse.json({ reviews: [] });

  const reviews = await Review.find({ productId: product._id }).sort({ createdAt: -1 }).lean();
  return NextResponse.json({ reviews: JSON.parse(JSON.stringify(reviews)) });
}

// Public product pages do not accept direct reviews. Reviews are submitted from paid customer orders.
export async function POST() {
  return NextResponse.json({ error: 'Reviews can be submitted only after successful payment from My Account' }, { status: 403 });
}