export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Order from '@/models/Order';
import { requireAdminPermission } from '@/lib/adminAccess';

function digitsPhone(value = '') {
  return String(value || '').replace(/\D/g, '');
}

/**
 * Lookup existing customers/orders by phone for WhatsApp order entry.
 * Does NOT invent history — only returns records already in the website DB.
 * historicalWhatsAppOrderRef entered by staff is a reference only (not validated here).
 */
export async function GET(req) {
  const { error } = await requireAdminPermission('orders', 'read');
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const phone = digitsPhone(searchParams.get('phone') || searchParams.get('mobile') || '');
  if (phone.length < 10) {
    return NextResponse.json({ error: 'Enter at least 10 digits of the phone number' }, { status: 400 });
  }

  const tail = phone.slice(-10);
  await dbConnect();

  const orders = await Order.find({
    $or: [
      { 'shippingAddress.phone': { $regex: `${tail}$` } },
      { 'shippingAddress.whatsappNumber': { $regex: `${tail}$` } },
      { phone: { $regex: `${tail}$` } },
      { whatsappNumber: { $regex: `${tail}$` } },
    ],
  })
    .select('orderNumber orderSource shippingAddress createdAt total paymentStatus opsStatus status items.title items.variant items.quantity')
    .sort({ createdAt: -1 })
    .limit(12)
    .lean();

  const addresses = [];
  const seen = new Set();
  for (const order of orders) {
    const addr = order.shippingAddress || {};
    const key = [
      addr.fullName,
      addr.line1,
      addr.city,
      addr.pincode,
      addr.phone || addr.whatsappNumber,
    ].map((v) => String(v || '').trim().toLowerCase()).join('|');
    if (!key.replace(/\|/g, '') || seen.has(key)) continue;
    seen.add(key);
    addresses.push({
      fullName: addr.fullName || '',
      phone: addr.phone || '',
      whatsappNumber: addr.whatsappNumber || addr.phone || '',
      email: addr.email || '',
      line1: addr.line1 || '',
      line2: addr.line2 || '',
      landmark: addr.landmark || '',
      district: addr.district || '',
      city: addr.city || '',
      state: addr.state || '',
      pincode: addr.pincode || '',
      fromOrderNumber: order.orderNumber,
    });
  }

  return NextResponse.json({
    phone: tail,
    matchedInDatabase: orders.length > 0,
    orderCount: orders.length,
    addresses,
    previousOrders: orders.map((order) => ({
      _id: order._id,
      orderNumber: order.orderNumber,
      orderSource: order.orderSource,
      createdAt: order.createdAt,
      total: order.total,
      paymentStatus: order.paymentStatus,
      opsStatus: order.opsStatus,
      status: order.status,
      fullName: order.shippingAddress?.fullName || '',
      itemSummary: (order.items || [])
        .map((item) => [item.title, item.variant].filter(Boolean).join(' · '))
        .filter(Boolean)
        .slice(0, 3)
        .join('; '),
    })),
    note: 'Only orders already stored in this database are shown. Historical WhatsApp order IDs not in the DB can still be entered as a reference on create.',
  });
}
