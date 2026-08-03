import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Order from '@/models/Order';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const orderNumber = searchParams.get('orderNumber')?.trim();
  const email = searchParams.get('email')?.trim()?.toLowerCase();

  if (!orderNumber || !email) {
    return NextResponse.json({ error: 'Order number and email are required.' }, { status: 400 });
  }

  await dbConnect();
  const order = await Order.findOne({ orderNumber }).populate('customer', 'email').lean();
  if (!order) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });

  const guestEmail = (order.guestEmail || order.shippingAddress?.email || '').toLowerCase();
  const customerEmail = (order.customer?.email || '').toLowerCase();
  if (guestEmail !== email && customerEmail !== email) {
    return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  }

  return NextResponse.json({
    orderNumber: order.orderNumber,
    status: order.status,
    trackingNumber: order.trackingNumber || null,
    deliveryEstimate: order.deliveryEstimate || null,
    createdAt: order.createdAt,
  });
}
