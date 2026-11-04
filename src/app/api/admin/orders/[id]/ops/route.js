export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import Order from '@/models/Order';
import Admin from '@/models/Admin';
import { requireAdminPermission, logAdminAudit } from '@/lib/adminAccess';
import { OPS_STATUSES, canPrintDesign, PRINTING_STARTED_OPS } from '@/lib/opsConstants';
import { appendTimeline, notifyAdmins, refreshPaymentTotals } from '@/lib/opsOrderHelpers';

export async function PATCH(req, { params }) {
  const { error, access } = await requireAdminPermission('orders', 'write');
  if (error) return error;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  await dbConnect();
  const order = await Order.findById(params.id);
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  const prevOps = order.opsStatus;
  const prevStatus = order.status;

  if (body.opsStatus) {
    if (!OPS_STATUSES.includes(body.opsStatus)) {
      return NextResponse.json({ error: 'Invalid ops status' }, { status: 400 });
    }
    if (['printing_in_progress', 'printing_completed', 'approved_printing_pending'].includes(body.opsStatus)) {
      if (!canPrintDesign(order)) {
        return NextResponse.json({
          error: 'Printing blocked until design is uploaded and approved (when preview is required)',
        }, { status: 409 });
      }
    }
    if (body.opsStatus === 'ready_to_dispatch') {
      const paidOk = order.paymentStatus === 'paid' || order.balanceStatus === 'fully_paid' || order.paymentException === true;
      const addressOk = order.shippingAddress?.line1 && order.shippingAddress?.city && order.shippingAddress?.pincode;
      if (!paidOk) {
        return NextResponse.json({ error: 'Payment must be verified (or exception granted) before ready to dispatch' }, { status: 409 });
      }
      if (!addressOk) {
        return NextResponse.json({ error: 'Complete delivery address required' }, { status: 409 });
      }
    }
    order.opsStatus = body.opsStatus;
    if (body.opsStatus === 'printing_in_progress' && !order.printingStartedAt) order.printingStartedAt = new Date();
    if (body.opsStatus === 'printing_completed') order.printingCompletedAt = new Date();
    if (body.opsStatus === 'production_in_progress' && !order.productionStartedAt) order.productionStartedAt = new Date();
    if (body.opsStatus === 'production_in_progress' || body.opsStatus === 'packing_pending') {
      order.status = 'on_process';
    }
    if (body.opsStatus === 'dispatched' || body.opsStatus === 'completed') {
      order.status = 'dispatched';
      if (!order.dispatchDate) order.dispatchDate = new Date();
    }
    if (body.opsStatus === 'packing_pending' || body.opsStatus === 'ready_to_dispatch') {
      if (!order.packedAt && body.opsStatus === 'ready_to_dispatch') order.packedAt = new Date();
    }
  }

  if (body.assignedTo !== undefined) {
    if (!body.assignedTo) {
      order.assignedTo = undefined;
      order.assignedToName = '';
    } else if (mongoose.Types.ObjectId.isValid(String(body.assignedTo))) {
      const admin = await Admin.findById(body.assignedTo).select('name email isActive').lean();
      if (!admin || admin.isActive === false) {
        return NextResponse.json({ error: 'Assignee not found' }, { status: 400 });
      }
      order.assignedTo = admin._id;
      order.assignedToName = admin.name || admin.email || '';
      await notifyAdmins([admin._id], {
        type: 'order_assigned',
        title: 'Order assigned',
        body: `${order.orderNumber} assigned to you`,
        order: order._id,
        orderNumber: order.orderNumber,
      }).catch(() => {});
    }
  }

  if (body.expectedDispatchDate !== undefined) {
    order.expectedDispatchDate = body.expectedDispatchDate ? new Date(body.expectedDispatchDate) : undefined;
  }
  if (body.previewRequired !== undefined) {
    order.previewRequired = !(body.previewRequired === false || body.previewRequired === 'no');
  }
  if (body.internalNotes !== undefined) order.internalNotes = String(body.internalNotes || '').trim();
  if (body.trackingNumber !== undefined) order.trackingNumber = String(body.trackingNumber || '').trim();
  if (body.trackingUrl !== undefined) order.trackingUrl = String(body.trackingUrl || '').trim();
  if (body.courierCompany !== undefined) order.courierCompany = String(body.courierCompany || '').trim();
  if (body.pickupStatus !== undefined) order.pickupStatus = body.pickupStatus;
  if (body.paymentException === true) {
    order.paymentException = true;
    order.paymentExceptionBy = access.adminId;
    order.paymentExceptionNote = String(body.paymentExceptionNote || '').trim();
  }

  if (body.status && ['ordered', 'on_process', 'dispatched', 'cancelled'].includes(body.status)) {
    if (PRINTING_STARTED_OPS.has(order.opsStatus) && body.status === 'cancelled') {
      // allow cancel with note
    }
    order.status = body.status;
  }

  appendTimeline(order, {
    type: 'ops_update',
    previousStatus: prevOps || prevStatus,
    newStatus: order.opsStatus || order.status,
    employee: access.adminId,
    employeeName: access.name || access.email || '',
    notes: String(body.notes || '').trim(),
  });

  refreshPaymentTotals(order);
  await order.save();
  await logAdminAudit({
    access,
    req,
    action: 'orders.ops_update',
    targetType: 'Order',
    targetId: String(order._id),
    details: { opsStatus: order.opsStatus, status: order.status },
  });

  return NextResponse.json({
    order: {
      _id: order._id,
      orderNumber: order.orderNumber,
      opsStatus: order.opsStatus,
      status: order.status,
      assignedTo: order.assignedTo,
      assignedToName: order.assignedToName,
      canPrintDesign: canPrintDesign(order),
    },
  });
}
