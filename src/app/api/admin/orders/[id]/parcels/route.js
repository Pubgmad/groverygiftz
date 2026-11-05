export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Order from '@/models/Order';
import { requireAdminPermission, logAdminAudit } from '@/lib/adminAccess';
import { appendTimeline, notifyAdmins } from '@/lib/opsOrderHelpers';
import { assertCanAccessOrder } from '@/lib/opsStaffAccess';

/**
 * Order-level Courier & Dispatch — append a parcel under this Order ID.
 * Does not require the Operations batch data-entry workflow.
 */
export async function POST(req, { params }) {
  const { error, access } = await requireAdminPermission('orders', 'write');
  if (error) return error;
  await dbConnect();
  const order = await Order.findById(params.id);
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  if (!assertCanAccessOrder(access, order)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const courierCompany = String(body.courierCompany || order.courierCompany || '').trim();
  const trackingNumber = String(body.trackingNumber || '').trim();
  const destinationState = String(body.destinationState || '').trim();
  const notes = String(body.notes || '').trim();
  const weightKg = body.weightKg !== '' && body.weightKg != null ? Number(body.weightKg) : null;
  const courierCharges = body.courierCharges !== '' && body.courierCharges != null
    ? Number(body.courierCharges)
    : null;
  const calculatedCourierCost = body.calculatedCourierCost !== '' && body.calculatedCourierCost != null
    ? Number(body.calculatedCourierCost)
    : null;

  let dispatchedAt = null;
  if (body.dispatchedAt) {
    const d = new Date(body.dispatchedAt);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: 'Invalid actual dispatch date/time' }, { status: 400 });
    }
    dispatchedAt = d;
  } else {
    return NextResponse.json({ error: 'Actual dispatch / handover date-time is required' }, { status: 400 });
  }

  if (!courierCompany) {
    return NextResponse.json({ error: 'Courier company is required' }, { status: 400 });
  }

  order.parcelRefs = order.parcelRefs || [];
  const parcelIndex = order.parcelRefs.length + 1;
  const parcelCode = `${order.orderNumber || 'ORD'}-P${String(parcelIndex).padStart(2, '0')}`;

  const parcel = {
    parcelCode,
    trackingNumber,
    dispatchedAt,
    courierCompany,
    weightKg: Number.isFinite(weightKg) ? weightKg : null,
    destinationState,
    courierCharges: Number.isFinite(courierCharges) ? courierCharges : null,
    calculatedCourierCost: Number.isFinite(calculatedCourierCost) ? calculatedCourierCost : null,
    dispatchedBy: access.adminId,
    dispatchedByName: access.name || access.email || '',
    notes,
    source: 'order_details',
  };
  order.parcelRefs.push(parcel);

  order.courierCompany = courierCompany;
  if (trackingNumber) {
    order.trackingNumber = trackingNumber;
    order.trackingUpdatedAt = new Date();
  }
  if (!order.dispatchDate || dispatchedAt.getTime() < new Date(order.dispatchDate).getTime()) {
    order.dispatchDate = dispatchedAt;
  }
  order.pickupStatus = 'handed_over';
  if (!['completed', 'cancelled'].includes(String(order.opsStatus || ''))) {
    order.opsStatus = trackingNumber ? 'tracking_pending' : 'dispatched';
    order.status = 'dispatched';
  }

  appendTimeline(order, {
    type: 'parcel_dispatched',
    newStatus: order.opsStatus,
    employee: access.adminId,
    employeeName: access.name || access.email || '',
    notes: `Parcel ${parcelCode} recorded on Order Details${trackingNumber ? ` · ${trackingNumber}` : ''}`,
  });
  await order.save();

  await logAdminAudit({
    access,
    req,
    action: 'orders.parcel_record',
    targetType: 'Order',
    targetId: String(order._id),
    details: { parcelCode, trackingNumber, orderNumber: order.orderNumber },
  });

  if (order.assignedTo) {
    await notifyAdmins([order.assignedTo], {
      type: 'courier_pickup',
      title: 'Parcel recorded',
      body: `${order.orderNumber} · ${parcelCode}`,
      order: order._id,
      orderNumber: order.orderNumber,
    }).catch(() => {});
  }

  const totalCourierExpense = (order.parcelRefs || []).reduce(
    (sum, p) => sum + (Number(p.courierCharges) || Number(p.calculatedCourierCost) || 0),
    0,
  );

  return NextResponse.json({
    parcel,
    parcelRefs: order.parcelRefs,
    totalCourierExpense,
    opsStatus: order.opsStatus,
    trackingNumber: order.trackingNumber,
    dispatchDate: order.dispatchDate,
  }, { status: 201 });
}
