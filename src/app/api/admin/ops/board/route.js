export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Order from '@/models/Order';
import { requireAdminPermission } from '@/lib/adminAccess';
import { OPS_STATUSES, OPS_STATUS_LABELS, OPS_STATUS_HELP, isDelayedOrder } from '@/lib/opsConstants';
import { mergeStaffOrderFilter } from '@/lib/opsStaffAccess';
import { todayIstYmd, istDayBounds } from '@/lib/istTime';

function paidOpsBase() {
  return {
    $or: [
      { paymentStatus: 'paid' },
      { orderSource: { $in: ['whatsapp', 'instagram'] } },
    ],
    status: { $ne: 'cancelled' },
  };
}

export async function GET(req) {
  let { error, access } = await requireAdminPermission('operations', 'read');
  if (error) {
    const ordersAccess = await requireAdminPermission('orders', 'read');
    if (ordersAccess.error) return error;
    access = ordersAccess.access;
  }

  await dbConnect();
  const { searchParams } = new URL(req.url);
  const opsStatus = searchParams.get('opsStatus') || '';
  const delayedOnly = searchParams.get('delayed') === '1';

  // Overdue = expected dispatch IST calendar day has fully passed (align with isDelayedOrder)
  const todayBounds = istDayBounds(todayIstYmd());
  const overdueBefore = todayBounds?.start || new Date();

  const counts = {};
  await Promise.all(OPS_STATUSES.map(async (status) => {
    counts[status] = await Order.countDocuments(
      mergeStaffOrderFilter({ ...paidOpsBase(), opsStatus: status }, access),
    );
  }));
  counts.delayed = await Order.countDocuments(mergeStaffOrderFilter({
    $or: [
      { paymentStatus: 'paid' },
      { orderSource: { $in: ['whatsapp', 'instagram'] } },
    ],
    expectedDispatchDate: { $lt: overdueBefore, $ne: null },
    opsStatus: { $nin: ['dispatched', 'completed', 'tracking_pending'] },
    status: { $nin: ['dispatched', 'cancelled'] },
  }, access));

  const expectedFrom = searchParams.get('expectedFrom') || '';
  const expectedTo = searchParams.get('expectedTo') || '';
  const source = String(searchParams.get('source') || '').toLowerCase();
  let expectedRange = null;
  if (expectedFrom || expectedTo) {
    const { istRangeBoundsSafe } = await import('@/lib/istTime');
    expectedRange = istRangeBoundsSafe(expectedFrom || expectedTo, expectedTo || expectedFrom);
  }

  const listCriteria = { ...paidOpsBase() };
  if (opsStatus === 'delayed') {
    listCriteria.expectedDispatchDate = { $lt: overdueBefore, $ne: null };
    listCriteria.opsStatus = { $nin: ['dispatched', 'completed', 'tracking_pending'] };
  } else if (opsStatus && OPS_STATUSES.includes(opsStatus)) {
    listCriteria.opsStatus = opsStatus;
  } else if (delayedOnly) {
    listCriteria.expectedDispatchDate = { $lt: overdueBefore, $ne: null };
    listCriteria.opsStatus = { $nin: ['dispatched', 'completed', 'tracking_pending'] };
  }
  if (expectedRange) {
    listCriteria.expectedDispatchDate = {
      ...(listCriteria.expectedDispatchDate || {}),
      $gte: expectedRange.start,
      $lte: expectedRange.end,
      $ne: null,
    };
  }
  if (source === 'website' || source === 'whatsapp' || source === 'instagram') {
    listCriteria.orderSource = source;
  }

  const filter = mergeStaffOrderFilter(listCriteria, access);
  const orders = await Order.find(filter)
    .select('orderNumber orderSource opsStatus status paymentStatus balanceStatus assignedToName expectedDispatchDate shippingAddress.fullName total previewRequired designApprovalStatus createdAt paidAt')
    .sort({ expectedDispatchDate: 1, createdAt: -1 })
    .limit(100)
    .lean();

  const dueToday = await Order.countDocuments(mergeStaffOrderFilter({
    ...paidOpsBase(),
    expectedDispatchDate: { $gte: todayBounds.start, $lte: todayBounds.end },
    opsStatus: { $nin: ['dispatched', 'completed'] },
    status: { $ne: 'cancelled' },
  }, access));

  return NextResponse.json({
    counts,
    labels: OPS_STATUS_LABELS,
    help: OPS_STATUS_HELP,
    statuses: OPS_STATUSES,
    alerts: {
      overdue: counts.delayed,
      dueToday,
    },
    orders: orders.map((o) => ({ ...o, delayed: isDelayedOrder(o) })),
    access: { adminId: access?.adminId },
  });
}
