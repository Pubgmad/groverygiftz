import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import dbConnect from '@/lib/db';
import { authOptions } from '@/lib/auth';
import Order from '@/models/Order';
import Product from '@/models/Product';
import Review from '@/models/Review';

const normalizeId = (value) => String(value?._id || value || '');

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.type !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();
  const reviews = await Review.find()
    .sort({ createdAt: -1 })
    .populate('customer', 'name email mobile phone')
    .lean();

  return NextResponse.json({ reviews });
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.type !== 'customer') {
    return NextResponse.json({ error: 'Please sign in as a customer to submit a review' }, { status: 401 });
  }

  await dbConnect();
  const body = await req.json();
  const productId = String(body.productId || '').trim();
  const orderNumber = String(body.orderNumber || '').trim();
  const rating = Number(body.rating || 0);
  const comment = String(body.comment || '').trim();
  const name = String(body.name || session.user.name || 'Customer').trim().slice(0, 80);

  if (!productId || !orderNumber) return NextResponse.json({ error: 'Order and product are required' }, { status: 400 });
  if (!rating || rating < 1 || rating > 5) return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 });
  if (!comment) return NextResponse.json({ error: 'Review comment is required' }, { status: 400 });

  const product = await Product.findById(productId).select('_id title').lean();
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

  const order = await Order.findOne({ orderNumber, customer: session.user.id, paymentStatus: 'paid' }).lean();
  if (!order) return NextResponse.json({ error: 'Reviews can be added only after successful payment' }, { status: 403 });

  const purchased = (order.items || []).some((item) => {
    const storedId = normalizeId(item.productId || item.product);
    return storedId && storedId === normalizeId(product._id);
  });
  if (!purchased) return NextResponse.json({ error: 'This product is not part of the paid order' }, { status: 403 });

  const existing = await Review.findOne({ productId: product._id, customer: session.user.id, orderNumber }).lean();
  if (existing) return NextResponse.json({ error: 'Review already submitted for this order item' }, { status: 409 });

  const review = await Review.create({
    productId: product._id,
    customer: session.user.id,
    order: order._id,
    orderNumber,
    productName: product.title,
    name,
    rating,
    comment: comment.slice(0, 1000),
    verified: true,
  });

  return NextResponse.json({ review: JSON.parse(JSON.stringify(review)) }, { status: 201 });
}