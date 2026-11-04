export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Order from '@/models/Order';
import {
  buildAdminOrderFilter,
  parseOrderReportFilters,
} from '@/lib/adminOrderQuery';
import { MAX_SHIPPING_LABEL_ORDERS } from '@/lib/shippingLabelData';

/** Returns order ObjectIds matching current admin filters (capped — never unbounded). */
export async function GET(req) {
  const { requireAdminPermission } = await import('@/lib/adminAccess');
  const { mergeStaffOrderFilter } = await import('@/lib/opsStaffAccess');
  const { error, access } = await requireAdminPermission('orders', 'read');
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const parsed = parseOrderReportFilters(searchParams);
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });

  await dbConnect();
  const base = buildAdminOrderFilter(parsed);
  // Exclude cancelled from bulk label selection even if filter status is empty
  if (!parsed.status) {
    base.status = { $nin: ['cancelled'] };
  }
  const filter = mergeStaffOrderFilter(base, access);

  const limit = Math.min(
    MAX_SHIPPING_LABEL_ORDERS,
    Math.max(1, Number(searchParams.get('limit') || MAX_SHIPPING_LABEL_ORDERS)),
  );

  const [total, rows] = await Promise.all([
    Order.countDocuments(filter),
    Order.find(filter).sort({ paidAt: -1, createdAt: -1 }).select('_id orderNumber').limit(limit).lean(),
  ]);

  return NextResponse.json({
    ids: rows.map((row) => String(row._id)),
    orderNumbers: rows.map((row) => row.orderNumber),
    returned: rows.length,
    total,
    capped: total > rows.length,
    max: MAX_SHIPPING_LABEL_ORDERS,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
