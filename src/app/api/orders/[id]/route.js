import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Order from '@/models/Order';
import DispatchBatch from '@/models/DispatchBatch';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { can, getRequestAdminAccess, requireAdminPermission } from '@/lib/adminAccess';
import { stripMakingCostFromOrder } from '@/lib/makingCost';
import { parseOrderPutAllowlist } from '@/lib/orderUpdateAllowlist';
import { appendTimeline } from '@/lib/opsOrderHelpers';
import { assertCanAccessOrder } from '@/lib/opsStaffAccess';
import { isPaymentSatisfiedForDispatch } from '@/lib/opsConstants';
import { logAdminAudit } from '@/lib/adminAccess';

export async function GET(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();
  const { id } = await params;
  const order = await Order.findById(id).populate('customer', 'name email phone').lean();
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (session.user.type === 'admin') {
    const access = await getRequestAdminAccess(session);
    if (!can(access, 'orders', 'read')) {
      return NextResponse.json({ error: 'You do not have permission to perform this action' }, { status: 403 });
    }
    if (!assertCanAccessOrder(access, order)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  } else if (order.customer?.toString() !== session.user.id && String(order.customer?._id || '') !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json(session.user.type === 'admin' ? order : stripMakingCostFromOrder(order));
}

export async function PUT(req, { params }) {
  const { error, access } = await requireAdminPermission('orders', 'write');
  if (error) return error;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = parseOrderPutAllowlist(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  await dbConnect();
  const { id } = await params;
  const order = await Order.findById(id);
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!assertCanAccessOrder(access, order)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const prevStatus = order.status;
  const prevTracking = order.trackingNumber || '';
  const prevTrackingUrl = order.trackingUrl || '';
  const { patch, trackingTouched } = parsed;

  if (patch.status !== undefined) {
    if (patch.status === 'dispatched' && !isPaymentSatisfiedForDispatch(order)) {
      return NextResponse.json({
        error: 'Payment must be verified (or exception granted) before dispatch',
      }, { status: 409 });
    }
    order.status = patch.status;
    // Never invent dispatchDate from status change — actual date comes from parcel handover.
    if (patch.status === 'dispatched' && !order.dispatchDate && Array.isArray(order.parcelRefs) && order.parcelRefs.length) {
      const earliest = order.parcelRefs
        .map((p) => (p.dispatchedAt ? new Date(p.dispatchedAt).getTime() : NaN))
        .filter((t) => Number.isFinite(t))
        .sort((a, b) => a - b)[0];
      if (earliest) order.dispatchDate = new Date(earliest);
    }
  }
  if (trackingTouched) {
    const handedOver = order.pickupStatus === 'handed_over'
      || (Array.isArray(order.parcelRefs) && order.parcelRefs.length > 0);
    if (!handedOver) {
      return NextResponse.json({
        error: 'Courier handover must be recorded before tracking details',
      }, { status: 409 });
    }
  }
  if (patch.trackingNumber !== undefined) {
    order.trackingNumber = patch.trackingNumber;
  }
  if (patch.trackingUrl !== undefined) {
    order.trackingUrl = patch.trackingUrl;
  }
  if (patch.courierCompany !== undefined) {
    order.courierCompany = patch.courierCompany;
  }
  if (trackingTouched) {
    order.trackingUpdatedAt = new Date();
    // Sync tracking onto existing parcel refs without changing their dispatchedAt history
    if (Array.isArray(order.parcelRefs) && order.parcelRefs.length) {
      const last = order.parcelRefs[order.parcelRefs.length - 1];
      if (patch.trackingNumber !== undefined) last.trackingNumber = patch.trackingNumber;
      if (patch.courierCompany !== undefined) last.courierCompany = patch.courierCompany;

      // Keep DispatchBatch.parcels in sync (tracking only — never touch dispatchedAt)
      if (last.batchId && last.parcelId) {
        const batch = await DispatchBatch.findById(last.batchId);
        if (batch) {
          const parcel = (batch.parcels || []).id(last.parcelId)
            || (batch.parcels || []).find((p) => String(p._id) === String(last.parcelId));
          if (parcel) {
            const originalDispatchedAt = parcel.dispatchedAt;
            if (patch.trackingNumber !== undefined) parcel.trackingNumber = patch.trackingNumber;
            if (patch.trackingUrl !== undefined) parcel.trackingUrl = patch.trackingUrl;
            if (patch.courierCompany !== undefined) parcel.courierCompany = patch.courierCompany;
            parcel.dispatchedAt = originalDispatchedAt;
            await batch.save();
          }
        }
      }
    }
    if (order.trackingNumber && order.opsStatus === 'tracking_pending') {
      order.opsStatus = 'completed';
    } else if (order.trackingNumber && order.opsStatus === 'dispatched') {
      order.opsStatus = 'tracking_pending';
    }
  }

  const statusChanged = patch.status !== undefined && String(prevStatus) !== String(order.status);
  const trackingChanged = trackingTouched && (
    String(prevTracking) !== String(order.trackingNumber || '')
    || String(prevTrackingUrl) !== String(order.trackingUrl || '')
    || patch.courierCompany !== undefined
  );

  if (statusChanged) {
    appendTimeline(order, {
      type: 'status_update',
      previousStatus: prevStatus,
      newStatus: order.status,
      employee: access.adminId,
      employeeName: access.name || access.email || '',
      notes: `Status → ${order.status}`,
    });
  }
  if (trackingChanged || (trackingTouched && !statusChanged)) {
    appendTimeline(order, {
      type: 'tracking_update',
      previousStatus: prevStatus,
      newStatus: order.status,
      employee: access.adminId,
      employeeName: access.name || access.email || '',
      notes: [
        order.courierCompany ? `Courier: ${order.courierCompany}` : '',
        order.trackingNumber ? `Tracking: ${order.trackingNumber}` : '',
        order.trackingUrl ? `URL: ${order.trackingUrl}` : '',
      ].filter(Boolean).join(' · ') || 'Tracking details updated',
    });
  }

  await order.save();
  await logAdminAudit({
    access,
    req,
    action: 'orders.put_allowlisted',
    targetType: 'Order',
    targetId: String(order._id),
    details: { fields: Object.keys(patch) },
  }).catch(() => {});
  return NextResponse.json(order);
}
