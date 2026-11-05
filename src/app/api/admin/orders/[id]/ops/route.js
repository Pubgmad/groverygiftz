export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import Order from '@/models/Order';
import Admin from '@/models/Admin';
import { requireAdminPermission, logAdminAudit } from '@/lib/adminAccess';
import { assertCanAccessOrder } from '@/lib/opsStaffAccess';
import {
  OPS_STATUSES,
  SALES_COMMS_KEYS,
  canPrintDesign,
  canTransitionOpsStatus,
  isPaymentGatedOpsStatus,
  isPaymentSatisfiedForDispatch,
  isPrintOpsStatus,
  isProductionOpsStatus,
  PRINTING_STARTED_OPS,
  requiresPaidRevisionGate,
} from '@/lib/opsConstants';
import { appendTimeline, notifyAdmins, refreshPaymentTotals } from '@/lib/opsOrderHelpers';
import DispatchBatch from '@/models/DispatchBatch';

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
  if (!assertCanAccessOrder(access, order)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const prevOps = order.opsStatus;
  const prevStatus = order.status;

  if (body.opsStatus) {
    if (!OPS_STATUSES.includes(body.opsStatus)) {
      return NextResponse.json({ error: 'Invalid ops status' }, { status: 400 });
    }
    if (!canTransitionOpsStatus(prevOps, body.opsStatus)) {
      return NextResponse.json({
        error: `Cannot transition from ${prevOps || 'unset'} to ${body.opsStatus}`,
      }, { status: 409 });
    }
    if (isPrintOpsStatus(body.opsStatus) && !canPrintDesign(order)) {
      return NextResponse.json({
        error: 'Printing blocked until design is uploaded and approved (when preview is required)',
      }, { status: 409 });
    }
    if (
      (isPrintOpsStatus(body.opsStatus) || isProductionOpsStatus(body.opsStatus))
      && requiresPaidRevisionGate(order)
    ) {
      return NextResponse.json({
        error: 'Paid revision must be verified before printing or production',
      }, { status: 409 });
    }
    if (isPaymentGatedOpsStatus(body.opsStatus) && !isPaymentSatisfiedForDispatch(order)) {
      return NextResponse.json({
        error: 'Payment must be verified (or exception granted) before this status',
      }, { status: 409 });
    }
    if (body.opsStatus === 'ready_to_dispatch') {
      const addressOk = order.shippingAddress?.line1 && order.shippingAddress?.city && order.shippingAddress?.pincode;
      if (!addressOk) {
        return NextResponse.json({ error: 'Complete delivery address required' }, { status: 409 });
      }
    }
    order.opsStatus = body.opsStatus;

    if (body.opsStatus === 'printing_assigned' || body.opsStatus === 'printing_in_progress') {
      let printAssignee = null;
      const candidate = body.printingAssignedTo || body.assignedTo || access.adminId;
      if (candidate && mongoose.Types.ObjectId.isValid(String(candidate))) {
        const admin = await Admin.findById(candidate).select('_id name email isActive').lean();
        if (admin && admin.isActive !== false) printAssignee = admin;
      }
      if (printAssignee) {
        order.printingAssignedTo = printAssignee._id;
        order.printingAssignedToName = printAssignee.name || printAssignee.email || '';
      } else if (access.adminId) {
        order.printingAssignedTo = access.adminId;
        order.printingAssignedToName = access.name || access.email || '';
      }
      if (body.opsStatus === 'printing_in_progress' && !order.printingStartedAt) {
        order.printingStartedAt = new Date();
      }
    }

    if (body.opsStatus === 'printing_completed') order.printingCompletedAt = new Date();
    if (body.opsStatus === 'production_in_progress' && !order.productionStartedAt) order.productionStartedAt = new Date();
    if (body.opsStatus === 'production_in_progress' || body.opsStatus === 'packing_pending'
      || body.opsStatus === 'manufacturing' || body.opsStatus === 'assembly' || body.opsStatus === 'finishing') {
      order.status = 'on_process';
    }
    if (body.opsStatus === 'dispatched' || body.opsStatus === 'completed') {
      order.status = 'dispatched';
      // Do not invent an actual dispatch date here — only parcel handover records that.
      // If a parcel was already handed over, keep the earliest parcel dispatch date.
      if (!order.dispatchDate && Array.isArray(order.parcelRefs) && order.parcelRefs.length) {
        const earliest = order.parcelRefs
          .map((p) => (p.dispatchedAt ? new Date(p.dispatchedAt).getTime() : NaN))
          .filter((t) => Number.isFinite(t))
          .sort((a, b) => a - b)[0];
        if (earliest) order.dispatchDate = new Date(earliest);
      }
    }
    if (body.opsStatus === 'packing_pending' || body.opsStatus === 'ready_to_dispatch') {
      if (!order.packedAt && body.opsStatus === 'ready_to_dispatch') order.packedAt = new Date();
    }
  }

  if (body.printingAssignedTo !== undefined) {
    if (!body.printingAssignedTo) {
      order.printingAssignedTo = undefined;
      order.printingAssignedToName = '';
    } else if (mongoose.Types.ObjectId.isValid(String(body.printingAssignedTo))) {
      const admin = await Admin.findById(body.printingAssignedTo).select('_id name email isActive').lean();
      if (!admin || admin.isActive === false) {
        return NextResponse.json({ error: 'Print assignee not found' }, { status: 400 });
      }
      order.printingAssignedTo = admin._id;
      order.printingAssignedToName = admin.name || admin.email || '';
      appendTimeline(order, {
        type: 'printing_assigned',
        employee: access.adminId,
        employeeName: access.name || access.email || '',
        notes: `Printing assigned to ${order.printingAssignedToName}`,
      });
    }
  }

  if (body.salesCommsChecklist && typeof body.salesCommsChecklist === 'object') {
    if (!order.salesCommsChecklist) order.salesCommsChecklist = {};
    for (const key of SALES_COMMS_KEYS) {
      if (body.salesCommsChecklist[key] === undefined) continue;
      const incoming = body.salesCommsChecklist[key];
      const done = typeof incoming === 'boolean' ? incoming : Boolean(incoming?.done);
      const prev = order.salesCommsChecklist[key] || {};
      order.salesCommsChecklist[key] = {
        done,
        at: done ? (prev.at || new Date()) : undefined,
        by: done ? (prev.by || access.adminId) : undefined,
        byName: done ? (prev.byName || access.name || access.email || '') : '',
        note: typeof incoming === 'object' && incoming?.note != null
          ? String(incoming.note)
          : (prev.note || ''),
      };
      if (done && !prev.done) {
        order.salesCommsChecklist[key].at = new Date();
        order.salesCommsChecklist[key].by = access.adminId;
        order.salesCommsChecklist[key].byName = access.name || access.email || '';
      }
    }
    order.markModified('salesCommsChecklist');
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
    const raw = body.expectedDispatchDate;
    if (!raw) {
      order.expectedDispatchDate = undefined;
    } else {
      const text = String(raw).trim();
      // YYYY-MM-DD → start of that IST calendar day (avoid UTC midnight shift)
      if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
        order.expectedDispatchDate = new Date(`${text}T00:00:00.000+05:30`);
      } else {
        order.expectedDispatchDate = new Date(text);
      }
    }
  }
  if (body.previewRequired !== undefined) {
    order.previewRequired = !(body.previewRequired === false || body.previewRequired === 'no');
  }
  if (body.internalNotes !== undefined) order.internalNotes = String(body.internalNotes || '').trim();
  const trackingTouched = body.trackingNumber !== undefined
    || body.trackingUrl !== undefined
    || body.courierCompany !== undefined;
  if (trackingTouched) {
    const handedOver = order.pickupStatus === 'handed_over'
      || (Array.isArray(order.parcelRefs) && order.parcelRefs.length > 0);
    if (!handedOver) {
      return NextResponse.json({
        error: 'Courier handover must be recorded before tracking details',
      }, { status: 409 });
    }
  }
  if (body.trackingNumber !== undefined) {
    order.trackingNumber = String(body.trackingNumber || '').trim();
    order.trackingUpdatedAt = new Date();
    // Update latest parcel tracking only — never change parcel dispatchedAt
    if (Array.isArray(order.parcelRefs) && order.parcelRefs.length) {
      order.parcelRefs[order.parcelRefs.length - 1].trackingNumber = order.trackingNumber;
    }
  }
  if (body.trackingUrl !== undefined) {
    order.trackingUrl = String(body.trackingUrl || '').trim();
  }
  if (body.courierCompany !== undefined) {
    order.courierCompany = String(body.courierCompany || '').trim();
    if (Array.isArray(order.parcelRefs) && order.parcelRefs.length) {
      order.parcelRefs[order.parcelRefs.length - 1].courierCompany = order.courierCompany;
    }
  }
  // Keep DispatchBatch.parcels in sync (tracking only — never touch dispatchedAt)
  if (trackingTouched && Array.isArray(order.parcelRefs) && order.parcelRefs.length) {
    const last = order.parcelRefs[order.parcelRefs.length - 1];
    if (last.batchId && last.parcelId) {
      const batch = await DispatchBatch.findById(last.batchId);
      if (batch) {
        const parcel = (batch.parcels || []).id(last.parcelId)
          || (batch.parcels || []).find((p) => String(p._id) === String(last.parcelId));
        if (parcel) {
          const originalDispatchedAt = parcel.dispatchedAt;
          if (body.trackingNumber !== undefined) parcel.trackingNumber = order.trackingNumber;
          if (body.trackingUrl !== undefined) parcel.trackingUrl = order.trackingUrl;
          if (body.courierCompany !== undefined) parcel.courierCompany = order.courierCompany;
          parcel.dispatchedAt = originalDispatchedAt;
          await batch.save();
        }
      }
    }
  }
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
      printingAssignedTo: order.printingAssignedTo,
      printingAssignedToName: order.printingAssignedToName,
      salesCommsChecklist: order.salesCommsChecklist,
      canPrintDesign: canPrintDesign(order),
    },
  });
}
