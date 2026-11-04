export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Order from '@/models/Order';
import { requireAdminPermission } from '@/lib/adminAccess';
import { OPS_STATUSES, OPS_STATUS_LABELS, isDelayedOrder } from '@/lib/opsConstants';
import { mergeStaffOrderFilter } from '@/lib/opsStaffAccess';

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
    expectedDispatchDate: { $lt: new Date() },
    opsStatus: { $nin: ['dispatched', 'completed'] },
    status: { $nin: ['dispatched', 'cancelled'] },
  }, access));

  const listCriteria = { ...paidOpsBase() };
  if (opsStatus === 'delayed') {
    listCriteria.expectedDispatchDate = { $lt: new Date() };
    listCriteria.opsStatus = { $nin: ['dispatched', 'completed'] };
  } else if (opsStatus && OPS_STATUSES.includes(opsStatus)) {
    listCriteria.opsStatus = opsStatus;
  } else if (delayedOnly) {
    listCriteria.expectedDispatchDate = { $lt: new Date() };
    listCriteria.opsStatus = { $nin: ['dispatched', 'completed'] };
  }

  const filter = mergeStaffOrderFilter(listCriteria, access);
  const orders = await Order.find(filter)
    .select('orderNumber orderSource opsStatus status paymentStatus balanceStatus assignedToName expectedDispatchDate shippingAddress.fullName total previewRequired designApprovalStatus createdAt paidAt')
    .sort({ expectedDispatchDate: 1, createdAt: -1 })
    .limit(100)
    .lean();

  return NextResponse.json({
    counts,
    labels: OPS_STATUS_LABELS,
    statuses: OPS_STATUSES,
    orders: orders.map((o) => ({ ...o, delayed: isDelayedOrder(o) })),
    access: { adminId: access?.adminId },
  });
}
