export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Order from '@/models/Order';
import Settings from '@/models/Settings';
import { getOrderDeliveryEstimate } from '@/lib/orderDeliveryEstimate';

export async function GET(req) {
  const { searchParams } = new URL(req?.url || 'http://localhost', 'http://localhost');
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

  const settings = await Settings.findOne().select('deliveryHolidays').lean();

  return NextResponse.json({
    orderNumber: order.orderNumber,
    status: order.status,
    trackingNumber: order.trackingNumber || null,
    deliveryEstimate: getOrderDeliveryEstimate(order, settings?.deliveryHolidays || []) || order.deliveryEstimate || null,
    createdAt: order.createdAt,
  });
}

