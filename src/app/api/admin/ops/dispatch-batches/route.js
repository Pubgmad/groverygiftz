export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import Order from '@/models/Order';
import DispatchBatch from '@/models/DispatchBatch';
import { requireAdminPermission, logAdminAudit } from '@/lib/adminAccess';
import { appendTimeline, notifyAdmins } from '@/lib/opsOrderHelpers';

export async function GET() {
  const { error } = await requireAdminPermission('operations', 'read');
  if (error) {
    const fallback = await requireAdminPermission('orders', 'read');
    if (fallback.error) return error;
  }
  await dbConnect();
  const batches = await DispatchBatch.find().sort({ createdAt: -1 }).limit(50).lean();
  return NextResponse.json({ batches });
}

export async function POST(req) {
  const { error, access } = await requireAdminPermission('operations', 'write');
  if (error) {
    const fallback = await requireAdminPermission('orders', 'write');
    if (fallback.error) return error;
  }
  const body = await req.json();
  const ids = (Array.isArray(body.orderIds) ? body.orderIds : [])
    .filter((id) => mongoose.Types.ObjectId.isValid(String(id)));
  if (!ids.length) return NextResponse.json({ error: 'Select at least one order' }, { status: 400 });

  await dbConnect();
  const orders = await Order.find({ _id: { $in: ids } });
  if (!orders.length) return NextResponse.json({ error: 'No orders found' }, { status: 404 });

  const eligible = [];
  const rejected = [];
  for (const order of orders) {
    if (order.dispatchBatch) {
      rejected.push({ id: String(order._id), orderNumber: order.orderNumber, reason: 'Already in a dispatch batch' });
      continue;
    }
    if (order.status === 'cancelled') {
      rejected.push({ id: String(order._id), orderNumber: order.orderNumber, reason: 'Cancelled' });
      continue;
    }
    const paidOk = order.paymentStatus === 'paid' || order.balanceStatus === 'fully_paid' || order.paymentException;
    const packed = order.opsStatus === 'ready_to_dispatch' || order.opsStatus === 'packing_pending' || order.packedAt;
    if (!paidOk && !order.paymentException) {
      rejected.push({ id: String(order._id), orderNumber: order.orderNumber, reason: 'Payment not verified' });
      continue;
    }
    if (!order.shippingAddress?.line1 || !order.shippingAddress?.pincode) {
      rejected.push({ id: String(order._id), orderNumber: order.orderNumber, reason: 'Incomplete address' });
      continue;
    }
    if (!packed && body.requirePacked !== false) {
      // allow if explicitly ready_to_dispatch or caller skips pack check
      if (order.opsStatus !== 'ready_to_dispatch') {
        rejected.push({ id: String(order._id), orderNumber: order.orderNumber, reason: 'Not ready to dispatch' });
        continue;
      }
    }
    eligible.push(order);
  }

  if (!eligible.length) {
    return NextResponse.json({ error: 'No eligible orders', rejected }, { status: 409 });
  }

  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const batchCode = `PICKUP-${day}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
  const batch = await DispatchBatch.create({
    batchCode,
    courierCompany: String(body.courierCompany || '').trim(),
    pickupDate: body.pickupDate ? new Date(body.pickupDate) : new Date(),
    notes: String(body.notes || '').trim(),
    createdBy: access.adminId,
    orderIds: eligible.map((o) => o._id),
    orderNumbers: eligible.map((o) => o.orderNumber),
    parcelCount: eligible.length,
    status: body.confirmPickup ? 'handed_over' : 'pickup_arranged',
    pickupConfirmedAt: body.confirmPickup ? new Date() : undefined,
  });

  for (const order of eligible) {
    order.dispatchBatch = batch._id;
    order.pickupStatus = body.confirmPickup ? 'handed_over' : 'pickup_arranged';
    order.courierCompany = batch.courierCompany || order.courierCompany;
    order.opsStatus = body.confirmPickup ? 'tracking_pending' : 'dispatched';
    order.status = 'dispatched';
    order.dispatchDate = order.dispatchDate || new Date();
    appendTimeline(order, {
      type: 'dispatch_batch',
      newStatus: order.opsStatus,
      employee: access.adminId,
      employeeName: access.name || access.email || '',
      notes: `Batch ${batchCode}`,
    });
    await order.save();
    if (order.assignedTo) {
      await notifyAdmins([order.assignedTo], {
        type: 'courier_pickup',
        title: 'Courier pickup batch',
        body: `${order.orderNumber} in ${batchCode}`,
        order: order._id,
        orderNumber: order.orderNumber,
      }).catch(() => {});
    }
  }

  await logAdminAudit({
    access,
    req,
    action: 'ops.dispatch_batch',
    targetType: 'DispatchBatch',
    targetId: String(batch._id),
    details: { batchCode, parcelCount: batch.parcelCount },
  });

  return NextResponse.json({ batch, rejected }, { status: 201 });
}
