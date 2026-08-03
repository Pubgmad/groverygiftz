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

// POST /api/products/[slug]/reviews
export async function POST(request, { params }) {
  await dbConnect();
  const { slug } = await params;
  const product = await Product.findOne({ slug }).select('_id').lean();
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

  const body = await request.json();
  const { name, rating, comment } = body;

  if (!name || !rating || !comment) {
    return NextResponse.json({ error: 'Name, rating, and comment are required' }, { status: 400 });
  }
  if (rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 });
  }

  const review = await Review.create({
    productId: product._id,
    name: String(name).slice(0, 80),
    rating: Number(rating),
    comment: String(comment).slice(0, 1000),
  });

  return NextResponse.json({ review: JSON.parse(JSON.stringify(review)) }, { status: 201 });
}
