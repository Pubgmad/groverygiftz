export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Order from '@/models/Order';
import Settings from '@/models/Settings';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { can, getRequestAdminAccess } from '@/lib/adminAccess';
import { getOrderDeliveryEstimate } from '@/lib/orderDeliveryEstimate';
import { stripMakingCostFromOrder } from '@/lib/makingCost';
import { buildAdminOrderFilter, parseOrderReportFilters, ORDER_STATUS_ALIASES } from '@/lib/adminOrderQuery';
import { mergeStaffOrderFilter } from '@/lib/opsStaffAccess';

export async function GET(req) {
  await dbConnect();
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req?.url || 'http://localhost', 'http://localhost');
  const parsed = parseOrderReportFilters(searchParams);
  if (parsed.error) {
    return NextResponse.json({
      error: parsed.error,
      orders: [],
      total: 0,
      page: parsed.page || 1,
      limit: parsed.limit || 20,
      pages: 0,
    }, { status: 400 });
  }

  const customerId = searchParams.get('customerId');
  const page = parsed.page;
  const limit = parsed.limit;
  const sortKey = searchParams.get('sort') || 'createdAt';
  const sortDir = searchParams.get('dir') === 'asc' ? 1 : -1;
  const sort = ['createdAt', 'paidAt', 'total', 'orderNumber', 'opsStatus'].includes(sortKey)
    ? { [sortKey]: sortDir }
    : { createdAt: -1 };

  let filter;
  if (session.user.type === 'admin') {
    const access = await getRequestAdminAccess(session);
    if (!can(access, 'orders', 'read')) return NextResponse.json({ error: 'You do not have permission to perform this action' }, { status: 403 });
    filter = mergeStaffOrderFilter(buildAdminOrderFilter(parsed), access);
    if (customerId) filter = mergeStaffOrderFilter({ ...buildAdminOrderFilter(parsed), customer: customerId }, access);
  } else {
    const email = String(session.user.email || '').trim().toLowerCase();
    filter = {
      paymentStatus: 'paid',
      $or: [
        { customer: session.user.id },
        ...(email ? [
          { guestEmail: email },
          { 'shippingAddress.email': email },
        ] : []),
      ],
    };
    if (parsed.status) {
      filter.status = { $in: ORDER_STATUS_ALIASES[parsed.status] || [parsed.status] };
    }
    if (parsed.paidAtFrom || parsed.paidAtTo) {
      filter.paidAt = {};
      if (parsed.paidAtFrom) filter.paidAt.$gte = parsed.paidAtFrom;
      if (parsed.paidAtTo) filter.paidAt.$lte = parsed.paidAtTo;
    }
  }

  const [orders, total] = await Promise.all([
    Order.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).lean(),
    Order.countDocuments(filter),
  ]);
  const settings = await Settings.findOne().select('deliveryHolidays').lean();
  const deliveryHolidays = settings?.deliveryHolidays || [];
  const displayOrders = orders.map((order) => {
    const next = {
      ...order,
      deliveryEstimate: getOrderDeliveryEstimate(order, deliveryHolidays) || order.deliveryEstimate,
    };
    return session.user.type === 'admin' ? next : stripMakingCostFromOrder(next);
  });

  return NextResponse.json({ orders: displayOrders, total, page, limit, pages: Math.ceil(total / limit) });
}

export async function POST() {
  return NextResponse.json({ error: 'Offline payment is disabled. Please use secure online payment.' }, { status: 405 });
}
