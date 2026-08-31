export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Order from '@/models/Order';
import Settings from '@/models/Settings';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getOrderDeliveryEstimate } from '@/lib/orderDeliveryEstimate';

const escapeRegex = (value = '') => String(value).split('').map((char) => '\\^$*+?.()|{}[]'.includes(char) ? '\\' + char : char).join('');

const boundedPageNumber = (value, fallback = 1) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

export async function GET(req) {
  await dbConnect();
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req?.url || 'http://localhost', 'http://localhost');
  const customerId = searchParams.get('customerId');
  const status = searchParams.get('status');
  const orderId = searchParams.get('orderId') || searchParams.get('orderNumber');
  const mobile = searchParams.get('mobile') || searchParams.get('mobileNumber');
  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');
  const page = boundedPageNumber(searchParams.get('page'));
  const requestedLimit = boundedPageNumber(searchParams.get('limit'), 20);
  const limit = Math.min(requestedLimit, 100);

  const filter = { paymentStatus: 'paid' };
  if (session.user.type === 'admin') {
    if (customerId) filter.customer = customerId;
  } else {
    const email = String(session.user.email || '').trim().toLowerCase();
    filter.$or = [
      { customer: session.user.id },
      ...(email ? [
        { guestEmail: email },
        { 'shippingAddress.email': email },
      ] : []),
    ];
  }
  if (status) {
    const normalizedStatus = status === 'pending' ? 'ordered' : status;
    const statusAliases = {
      ordered: ['ordered', 'pending'],
      on_process: ['on_process', 'processing'],
      dispatched: ['dispatched', 'shipped', 'delivered'],
      cancelled: ['cancelled'],
    };
    filter.status = { $in: statusAliases[normalizedStatus] || [status] };
  }
  if (session.user.type === 'admin' && orderId?.trim()) {
    filter.orderNumber = { $regex: escapeRegex(orderId.trim()), $options: 'i' };
  }
  if (session.user.type === 'admin' && mobile?.trim()) {
    const mobileTerm = mobile.trim().replace(/\D/g, '') || mobile.trim();
    const mobileRegex = { $regex: escapeRegex(mobileTerm), $options: 'i' };
    filter.$and = [
      ...(filter.$and || []),
      {
        $or: [
          { 'shippingAddress.phone': mobileRegex },
          { 'shippingAddress.whatsappNumber': mobileRegex },
          { phone: mobileRegex },
          { whatsappNumber: mobileRegex },
        ],
      },
    ];
  }
  if (dateFrom || dateTo) {
    filter.paidAt = {};
    if (dateFrom) filter.paidAt.$gte = new Date(dateFrom + 'T00:00:00.000+05:30');
    if (dateTo) filter.paidAt.$lte = new Date(dateTo + 'T23:59:59.999+05:30');
  }

  const [orders, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Order.countDocuments(filter),
  ]);
  const settings = await Settings.findOne().select('deliveryHolidays').lean();
  const deliveryHolidays = settings?.deliveryHolidays || [];
  const displayOrders = orders.map((order) => ({
    ...order,
    deliveryEstimate: getOrderDeliveryEstimate(order, deliveryHolidays) || order.deliveryEstimate,
  }));

  return NextResponse.json({ orders: displayOrders, total, page, limit, pages: Math.ceil(total / limit) });
}

export async function POST() {
  return NextResponse.json({ error: 'Offline payment is disabled. Please use secure online payment.' }, { status: 405 });
}
