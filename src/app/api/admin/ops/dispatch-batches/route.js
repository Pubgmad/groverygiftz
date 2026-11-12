export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import Order from '@/models/Order';
import DispatchBatch from '@/models/DispatchBatch';
import { requireAdminPermission, logAdminAudit } from '@/lib/adminAccess';
import { appendTimeline, notifyAdmins } from '@/lib/opsOrderHelpers';
import { isPaymentSatisfiedForDispatch } from '@/lib/opsConstants';
import { todayIstYmd } from '@/lib/istTime';
import { DISPATCH_ORDER_SELECT } from '@/lib/adminOrderFields';

async function requireOpsWrite() {
  let { error, access } = await requireAdminPermission('operations', 'write');
  if (error) {
    const fallback = await requireAdminPermission('orders', 'write');
    if (fallback.error) return { error };
    access = fallback.access;
  }
  return { access };
}

function parcelCodeFor(batchCode, index) {
  return `${batchCode}-P${String(index).padStart(2, '0')}`;
}

function resolveDispatchedAt(raw, { allowNow = false } = {}) {
  if (raw) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return allowNow ? new Date() : null;
}

function parsePickupDate(raw) {
  if (!raw) return new Date();
  const text = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return new Date(`${text}T00:00:00.000+05:30`);
  }
  const d = new Date(text);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

async function attachParcelToOrders(orders, batch, parcel, access) {
  for (const order of orders) {
    order.dispatchBatch = batch._id;
    order.courierCompany = parcel.courierCompany || order.courierCompany || batch.courierCompany;
    if (parcel.trackingNumber) {
      order.trackingNumber = parcel.trackingNumber;
      order.trackingUpdatedAt = new Date();
    }
    if (parcel.trackingUrl) order.trackingUrl = parcel.trackingUrl;
    // Keep earliest actual handover across multi-parcel history
    if (parcel.dispatchedAt) {
      const t = new Date(parcel.dispatchedAt).getTime();
      if (Number.isFinite(t) && (!order.dispatchDate || t < new Date(order.dispatchDate).getTime())) {
        order.dispatchDate = parcel.dispatchedAt;
      }
    }
    order.pickupStatus = 'handed_over';
    if (!['completed', 'cancelled'].includes(String(order.opsStatus || ''))) {
      order.opsStatus = parcel.trackingNumber ? 'tracking_pending' : 'dispatched';
      order.status = 'dispatched';
    }
    order.parcelRefs = order.parcelRefs || [];
    order.parcelRefs.push({
      batchId: batch._id,
      parcelId: parcel._id,
      parcelCode: parcel.parcelCode,
      trackingNumber: parcel.trackingNumber || '',
      dispatchedAt: parcel.dispatchedAt,
      courierCompany: parcel.courierCompany || batch.courierCompany || '',
      weightKg: parcel.weightKg != null ? parcel.weightKg : null,
      destinationState: parcel.destinationState || '',
      courierCharges: parcel.manualCourierCost != null
        ? parcel.manualCourierCost
        : (parcel.calculatedCourierCost != null ? parcel.calculatedCourierCost : null),
      calculatedCourierCost: parcel.calculatedCourierCost != null ? parcel.calculatedCourierCost : null,
      dispatchedBy: parcel.recordedBy || access.adminId,
      dispatchedByName: parcel.recordedByName || access.name || access.email || '',
      notes: parcel.notes || '',
      source: 'dispatch_batch',
    });
    appendTimeline(order, {
      type: 'parcel_dispatched',
      newStatus: order.opsStatus,
      employee: access.adminId,
      employeeName: access.name || access.email || '',
      notes: `Parcel ${parcel.parcelCode} dispatched${parcel.trackingNumber ? ` · ${parcel.trackingNumber}` : ''}`,
    });
    await order.save();
    if (order.assignedTo) {
      await notifyAdmins([order.assignedTo], {
        type: 'courier_pickup',
        title: 'Parcel dispatched',
        body: `${order.orderNumber} · ${parcel.parcelCode}`,
        order: order._id,
        orderNumber: order.orderNumber,
      }).catch(() => {});
    }
  }
}

export async function GET(req) {
  const { error } = await requireAdminPermission('operations', 'read');
  if (error) {
    const fallback = await requireAdminPermission('orders', 'read');
    if (fallback.error) return error;
  }
  await dbConnect();
  const { searchParams } = new URL(req.url);
  const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit')) || 50));
  const batches = await DispatchBatch.find().sort({ createdAt: -1 }).limit(limit).lean();
  return NextResponse.json({ batches });
}

/**
 * Create a dispatch batch with one or more parcel records.
 * Body:
 *  - orderIds: string[] (orders in the first / only parcel)
 *  - parcels?: [{ orderIds, trackingNumber, weightKg, dispatchedAt, courierCompany, destinationState, calculatedCourierCost, manualCourierCost, notes }]
 *  - courierCompany, pickupDate, notes, confirmPickup
 */
export async function POST(req) {
  const gate = await requireOpsWrite();
  if (gate.error) return gate.error;
  const { access } = gate;
  const body = await req.json();

  await dbConnect();

  const day = todayIstYmd().replace(/-/g, '');
  const batchCode = `PICKUP-${day}-${Date.now().toString(36).slice(-4).toUpperCase()}`;

  let parcelInputs = Array.isArray(body.parcels) && body.parcels.length
    ? body.parcels
    : [{
      orderIds: body.orderIds,
      trackingNumber: body.trackingNumber,
      trackingUrl: body.trackingUrl,
      weightKg: body.weightKg,
      dispatchedAt: body.dispatchedAt || undefined,
      courierCompany: body.courierCompany,
      destinationState: body.destinationState,
      calculatedCourierCost: body.calculatedCourierCost,
      manualCourierCost: body.manualCourierCost,
      notes: body.notes,
    }];

  const allOrderIdSet = new Set();
  const resolvedParcels = [];

  for (const input of parcelInputs) {
    const ids = (Array.isArray(input.orderIds) ? input.orderIds : [])
      .filter((id) => mongoose.Types.ObjectId.isValid(String(id)))
      .map((id) => String(id));
    if (!ids.length) continue;
    ids.forEach((id) => allOrderIdSet.add(id));
    resolvedParcels.push({ input, ids });
  }

  if (!resolvedParcels.length) {
    return NextResponse.json({ error: 'Select at least one order for a parcel' }, { status: 400 });
  }

  const orders = await Order.find({ _id: { $in: [...allOrderIdSet] } }).select(DISPATCH_ORDER_SELECT);
  const byId = Object.fromEntries(orders.map((o) => [String(o._id), o]));

  const eligibleIds = new Set();
  const rejected = [];
  for (const id of allOrderIdSet) {
    const order = byId[id];
    if (!order) {
      rejected.push({ id, reason: 'Order not found' });
      continue;
    }
    if (order.status === 'cancelled') {
      rejected.push({ id, orderNumber: order.orderNumber, reason: 'Cancelled' });
      continue;
    }
    if (!isPaymentSatisfiedForDispatch(order)) {
      rejected.push({ id, orderNumber: order.orderNumber, reason: 'Payment not verified' });
      continue;
    }
    if (!order.shippingAddress?.line1 || !order.shippingAddress?.pincode) {
      rejected.push({ id, orderNumber: order.orderNumber, reason: 'Incomplete address' });
      continue;
    }
    // Multi-parcel allowed: orders already in a batch may receive additional parcels
    if (body.requirePacked !== false) {
      const packed = order.opsStatus === 'ready_to_dispatch' || order.opsStatus === 'packing_pending' || order.packedAt
        || order.opsStatus === 'dispatched' || order.opsStatus === 'tracking_pending'
        || (Array.isArray(order.parcelRefs) && order.parcelRefs.length > 0);
      if (!packed && order.opsStatus !== 'ready_to_dispatch') {
        rejected.push({ id, orderNumber: order.orderNumber, reason: 'Not ready to dispatch' });
        continue;
      }
    }
    eligibleIds.add(id);
  }

  const finalParcelSpecs = resolvedParcels
    .map(({ input, ids }) => ({ input, ids: ids.filter((id) => eligibleIds.has(id)) }))
    .filter((row) => row.ids.length);

  if (!finalParcelSpecs.length) {
    return NextResponse.json({ error: 'No eligible orders', rejected }, { status: 409 });
  }

  const confirmNow = body.confirmPickup !== false;
  const batchCourier = String(body.courierCompany || finalParcelSpecs[0]?.input?.courierCompany || '').trim();

  const batch = new DispatchBatch({
    batchCode,
    courierCompany: batchCourier,
    pickupDate: parsePickupDate(body.pickupDate),
    notes: String(body.notes || '').trim(),
    createdBy: access.adminId,
    createdByName: access.name || access.email || '',
    orderIds: [...new Set(finalParcelSpecs.flatMap((p) => p.ids))],
    orderNumbers: [],
    parcelCount: 0,
    parcels: [],
    status: confirmNow ? 'handed_over' : 'pickup_arranged',
    pickupConfirmedAt: confirmNow ? new Date() : undefined,
  });

  const orderNumberMap = {};
  for (const id of batch.orderIds) {
    orderNumberMap[id] = byId[id]?.orderNumber || '';
  }
  batch.orderNumbers = batch.orderIds.map((id) => orderNumberMap[String(id)]).filter(Boolean);

  // Parcel records (with actual dispatchedAt) are created only at courier handover.
  // Arranging a pickup batch must not invent dispatch dates.
  if (confirmNow) {
    for (let i = 0; i < finalParcelSpecs.length; i += 1) {
      const { input, ids } = finalParcelSpecs[i];
      const rawDispatch = input.dispatchedAt || body.dispatchedAt;
      const dispatchedAt = resolveDispatchedAt(rawDispatch, { allowNow: false });
      if (!dispatchedAt) {
        return NextResponse.json({ error: 'Actual dispatch date/time is required when recording handover' }, { status: 400 });
      }
      const parcel = {
        parcelCode: parcelCodeFor(batchCode, i + 1),
        orderIds: ids,
        orderNumbers: ids.map((id) => orderNumberMap[id]).filter(Boolean),
        trackingNumber: String(input.trackingNumber || '').trim(),
        trackingUrl: String(input.trackingUrl || '').trim(),
        weightKg: input.weightKg != null && input.weightKg !== '' ? Number(input.weightKg) : null,
        dispatchedAt,
        courierCompany: String(input.courierCompany || batchCourier).trim(),
        destinationState: String(input.destinationState || '').trim()
          || byId[ids[0]]?.shippingAddress?.state
          || '',
        calculatedCourierCost: input.calculatedCourierCost != null && input.calculatedCourierCost !== ''
          ? Number(input.calculatedCourierCost)
          : null,
        manualCourierCost: input.manualCourierCost != null && input.manualCourierCost !== ''
          ? Number(input.manualCourierCost)
          : null,
        recordedBy: access.adminId,
        recordedByName: access.name || access.email || '',
        notes: String(input.notes || '').trim(),
      };
      batch.parcels.push(parcel);
    }
    batch.parcelCount = batch.parcels.length;
  } else {
    batch.parcelCount = finalParcelSpecs.reduce((sum, row) => sum + row.ids.length, 0);
  }

  await batch.save();

  if (confirmNow) {
    for (const parcel of batch.parcels) {
      const parcelOrders = parcel.orderIds.map((id) => byId[String(id)]).filter(Boolean);
      await attachParcelToOrders(parcelOrders, batch, parcel, access);
    }
  } else {
    for (const id of batch.orderIds) {
      const order = byId[String(id)];
      if (!order) continue;
      order.dispatchBatch = batch._id;
      order.pickupStatus = 'pickup_arranged';
      order.courierCompany = batch.courierCompany || order.courierCompany;
      appendTimeline(order, {
        type: 'dispatch_batch',
        newStatus: order.opsStatus,
        employee: access.adminId,
        employeeName: access.name || access.email || '',
        notes: `Batch ${batchCode} arranged (awaiting handover — no dispatch date yet)`,
      });
      await order.save();
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

/**
 * PATCH actions:
 *  - confirmPickup / status handed_over: create dispatch timestamps if missing
 *  - action=add_parcel: append parcel (multi-parcel / multi-order)
 *  - action=update_tracking: update tracking only — never overwrite dispatchedAt
 *  - status=completed
 */
export async function PATCH(req) {
  const gate = await requireOpsWrite();
  if (gate.error) return gate.error;
  const { access } = gate;
  const body = await req.json();
  if (!body.batchId) return NextResponse.json({ error: 'batchId required' }, { status: 400 });
  await dbConnect();
  const batch = await DispatchBatch.findById(body.batchId);
  if (!batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 });

  if (body.action === 'update_tracking') {
    const parcel = (batch.parcels || []).id(body.parcelId)
      || (batch.parcels || []).find((p) => String(p._id) === String(body.parcelId) || p.parcelCode === body.parcelCode);
    if (!parcel) return NextResponse.json({ error: 'Parcel not found' }, { status: 404 });
    const originalDispatchedAt = parcel.dispatchedAt;
    if (body.trackingNumber != null) parcel.trackingNumber = String(body.trackingNumber).trim();
    if (body.trackingUrl != null) parcel.trackingUrl = String(body.trackingUrl).trim();
    if (body.courierCompany != null) parcel.courierCompany = String(body.courierCompany).trim();
    // Preserve original dispatch date/time and other history
    parcel.dispatchedAt = originalDispatchedAt;
    await batch.save();

    const orders = await Order.find({ _id: { $in: parcel.orderIds } }).select(DISPATCH_ORDER_SELECT);
    for (const order of orders) {
      if (parcel.trackingNumber) {
        order.trackingNumber = parcel.trackingNumber;
        order.trackingUpdatedAt = new Date();
      }
      if (parcel.trackingUrl) order.trackingUrl = parcel.trackingUrl;
      if (parcel.courierCompany) order.courierCompany = parcel.courierCompany;
      (order.parcelRefs || []).forEach((ref) => {
        if (String(ref.parcelId) === String(parcel._id)) {
          ref.trackingNumber = parcel.trackingNumber;
          if (parcel.courierCompany) ref.courierCompany = parcel.courierCompany;
          // do not touch ref.dispatchedAt
        }
      });
      appendTimeline(order, {
        type: 'tracking_updated',
        newStatus: order.opsStatus,
        employee: access.adminId,
        employeeName: access.name || access.email || '',
        notes: `Tracking updated for ${parcel.parcelCode} (dispatch date preserved)`,
      });
      await order.save();
    }
    return NextResponse.json({ batch, parcel });
  }

  if (body.action === 'add_parcel') {
    const ids = (Array.isArray(body.orderIds) ? body.orderIds : [])
      .filter((id) => mongoose.Types.ObjectId.isValid(String(id)));
    if (!ids.length) return NextResponse.json({ error: 'orderIds required' }, { status: 400 });
    const orders = await Order.find({ _id: { $in: ids } }).select(DISPATCH_ORDER_SELECT);
    if (!orders.length) return NextResponse.json({ error: 'No orders found' }, { status: 404 });

    const nextIndex = (batch.parcels?.length || 0) + 1;
    const parcel = {
      parcelCode: body.parcelCode || parcelCodeFor(batch.batchCode, nextIndex),
      orderIds: orders.map((o) => o._id),
      orderNumbers: orders.map((o) => o.orderNumber),
      trackingNumber: String(body.trackingNumber || '').trim(),
      trackingUrl: String(body.trackingUrl || '').trim(),
      weightKg: body.weightKg != null && body.weightKg !== '' ? Number(body.weightKg) : null,
      dispatchedAt: resolveDispatchedAt(body.dispatchedAt, { allowNow: false }),
      courierCompany: String(body.courierCompany || batch.courierCompany || '').trim(),
      destinationState: String(body.destinationState || orders[0]?.shippingAddress?.state || '').trim(),
      calculatedCourierCost: body.calculatedCourierCost != null && body.calculatedCourierCost !== ''
        ? Number(body.calculatedCourierCost)
        : null,
      manualCourierCost: body.manualCourierCost != null && body.manualCourierCost !== ''
        ? Number(body.manualCourierCost)
        : null,
      recordedBy: access.adminId,
      recordedByName: access.name || access.email || '',
      notes: String(body.notes || '').trim(),
    };
    if (!parcel.dispatchedAt) {
      return NextResponse.json({ error: 'Actual dispatch date/time is required when adding a parcel' }, { status: 400 });
    }
    batch.parcels.push(parcel);
    batch.parcelCount = batch.parcels.length;
    const existing = new Set((batch.orderIds || []).map(String));
    for (const o of orders) {
      if (!existing.has(String(o._id))) {
        batch.orderIds.push(o._id);
        batch.orderNumbers.push(o.orderNumber);
      }
    }
    batch.status = 'handed_over';
    batch.pickupConfirmedAt = batch.pickupConfirmedAt || new Date();
    await batch.save();

    const savedParcel = batch.parcels[batch.parcels.length - 1];
    await attachParcelToOrders(orders, batch, savedParcel, access);

    await logAdminAudit({
      access,
      req,
      action: 'ops.parcel_add',
      targetType: 'DispatchBatch',
      targetId: String(batch._id),
      details: { parcelCode: savedParcel.parcelCode, orderNumbers: savedParcel.orderNumbers },
    });

    return NextResponse.json({ batch, parcel: savedParcel });
  }

  if (body.confirmPickup === true || body.status === 'handed_over') {
    batch.status = 'handed_over';
    batch.pickupConfirmedAt = batch.pickupConfirmedAt || new Date();
    if (!batch.parcels?.length) {
      const orders = await Order.find({ _id: { $in: batch.orderIds } }).select(DISPATCH_ORDER_SELECT);
      const parcel = {
        parcelCode: parcelCodeFor(batch.batchCode, 1),
        orderIds: orders.map((o) => o._id),
        orderNumbers: orders.map((o) => o.orderNumber),
        trackingNumber: '',
        trackingUrl: '',
        weightKg: null,
        // Actual handover time only — never reuse scheduled pickupDate as dispatch date
        dispatchedAt: resolveDispatchedAt(body.dispatchedAt, { allowNow: false }),
        courierCompany: batch.courierCompany || '',
        destinationState: orders[0]?.shippingAddress?.state || '',
        calculatedCourierCost: null,
        manualCourierCost: null,
        recordedBy: access.adminId,
        recordedByName: access.name || access.email || '',
        notes: 'Handover recorded',
      };
      if (!parcel.dispatchedAt) {
        return NextResponse.json({ error: 'Actual dispatch date/time is required when recording handover' }, { status: 400 });
      }
      batch.parcels.push(parcel);
      batch.parcelCount = 1;
      await batch.save();
      const saved = batch.parcels[0];
      await attachParcelToOrders(orders, batch, saved, access);
    } else {
      const orders = await Order.find({ _id: { $in: batch.orderIds } }).select(DISPATCH_ORDER_SELECT);
      const byId = Object.fromEntries(orders.map((o) => [String(o._id), o]));
      for (const parcel of batch.parcels) {
        if (!parcel.dispatchedAt) {
          const stamped = resolveDispatchedAt(body.dispatchedAt, { allowNow: false });
          if (!stamped) {
            return NextResponse.json({ error: 'Actual dispatch date/time is required when recording handover' }, { status: 400 });
          }
          parcel.dispatchedAt = stamped;
        }
        const parcelOrders = parcel.orderIds.map((id) => byId[String(id)]).filter(Boolean);
        // Only attach if order does not already have this parcel ref
        const needAttach = parcelOrders.filter((o) => !(o.parcelRefs || []).some((r) => String(r.parcelId) === String(parcel._id)));
        if (needAttach.length) await attachParcelToOrders(needAttach, batch, parcel, access);
      }
      await batch.save();
    }
  }
  if (body.status === 'completed') {
    batch.status = 'completed';
  }
  await batch.save();
  return NextResponse.json({ batch });
}
