export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Order from '@/models/Order';
import Settings from '@/models/Settings';
import { getOrderDeliveryEstimate } from '@/lib/orderDeliveryEstimate';
import { verifyShippingLabelToken } from '@/lib/shippingLabelToken';
import { ORDER_STATUS_LABELS } from '@/lib/adminOrderQuery';

/**
 * Public QR tracking lookup.
 * Returns only non-financial, non-PII shipping status fields.
 */
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token') || '';
  const orderId = verifyShippingLabelToken(token);
  if (!orderId) {
    return NextResponse.json({ error: 'Invalid or expired tracking link.' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }

  await dbConnect();
  const order = await Order.findById(orderId)
    .select('orderNumber status trackingNumber deliveryEstimate paidAt createdAt isOutOfTamilNadu')
    .lean();
  if (!order) {
    return NextResponse.json({ error: 'Order not found.' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }

  const settings = await Settings.findOne().select('deliveryHolidays siteName tradeName').lean();
  const statusKey = String(order.status || 'ordered');

  return NextResponse.json({
    orderNumber: order.orderNumber,
    status: statusKey,
    statusLabel: ORDER_STATUS_LABELS[statusKey] || statusKey,
    trackingNumber: order.trackingNumber || null,
    deliveryEstimate: getOrderDeliveryEstimate(order, settings?.deliveryHolidays || []) || order.deliveryEstimate || null,
    brand: settings?.tradeName || settings?.siteName || 'GroveryGiftz',
  }, { headers: { 'Cache-Control': 'no-store' } });
}
