export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Order from '@/models/Order';
import { requireAdminPermission, logAdminAudit } from '@/lib/adminAccess';
import { saveUploadFile } from '@/lib/uploadStorage';
import { appendTimeline, refreshPaymentTotals, notifyAdmins } from '@/lib/opsOrderHelpers';
import { assertCanAccessOrder } from '@/lib/opsStaffAccess';

function parsePaidAt(raw) {
  if (raw == null || String(raw).trim() === '') return null;
  const d = new Date(String(raw));
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export async function POST(req, { params }) {
  const { error, access } = await requireAdminPermission('orders', 'write');
  if (error) return error;
  await dbConnect();
  const order = await Order.findById(params.id);
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  if (!assertCanAccessOrder(access, order)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const contentType = req.headers.get('content-type') || '';
  let amount; let kind; let method; let reference; let paidAtRaw; let notes; let verified = false; let screenshotPath; let screenshotUrl;

  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData();
    amount = Number(form.get('amount'));
    kind = String(form.get('kind') || 'advance');
    method = String(form.get('method') || '').trim();
    reference = String(form.get('reference') || '').trim();
    paidAtRaw = form.get('paidAt');
    notes = String(form.get('notes') || '').trim();
    verified = form.get('verified') === 'true';
    const file = form.get('screenshot');
    if (file && typeof file !== 'string' && file.size) {
      const saved = await saveUploadFile(file, 'payment-proofs');
      screenshotPath = saved.relativePath;
      screenshotUrl = saved.url;
    }
  } else {
    const body = await req.json();
    amount = Number(body.amount);
    kind = String(body.kind || 'advance');
    method = String(body.method || '').trim();
    reference = String(body.reference || '').trim();
    paidAtRaw = body.paidAt;
    notes = String(body.notes || '').trim();
    verified = body.verified === true;
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Valid payment amount is required' }, { status: 400 });
  }
  if (!['advance', 'balance', 'additional', 'revision', 'other'].includes(kind)) {
    return NextResponse.json({ error: 'Invalid payment kind' }, { status: 400 });
  }
  if (String(order.orderSource || '').toLowerCase() === 'website') {
    return NextResponse.json({
      error: 'Manual payments are for WhatsApp orders only. Website orders use Cashfree.',
    }, { status: 400 });
  }

  const paymentPaidAt = parsePaidAt(paidAtRaw);
  if (!paymentPaidAt) {
    return NextResponse.json({ error: 'Actual payment date/time is required' }, { status: 400 });
  }

  order.paymentRecords = order.paymentRecords || [];
  order.paymentRecords.push({
    kind,
    amount,
    method,
    reference,
    screenshotPath,
    screenshotUrl,
    paidAt: paymentPaidAt,
    verified,
    verifiedBy: verified ? access.adminId : undefined,
    verifiedAt: verified ? new Date() : undefined,
    notes,
    recordedBy: access.adminId,
    recordedByName: access.name || access.email || '',
  });

  if (kind === 'revision' && amount > 0) {
    order.revisionCharges = Math.max(Number(order.revisionCharges) || 0, amount);
    if (verified) order.revisionPaymentVerified = true;
  }

  refreshPaymentTotals(order);
  appendTimeline(order, {
    type: 'payment_recorded',
    newStatus: order.balanceStatus,
    employee: access.adminId,
    employeeName: access.name || access.email || '',
    notes: `${kind} ₹${amount}${verified ? ' (verified)' : ' (unverified screenshot does not auto-verify)'}`,
    fileRef: screenshotPath || '',
  });
  await order.save();

  await logAdminAudit({
    access,
    req,
    action: 'orders.payment_record',
    targetType: 'Order',
    targetId: String(order._id),
    details: { kind, amount, verified, orderNumber: order.orderNumber },
  });

  if (order.assignedTo) {
    await notifyAdmins([order.assignedTo], {
      type: 'payment_recorded',
      title: 'Payment recorded',
      body: `${order.orderNumber}: ${kind} ₹${amount}`,
      order: order._id,
      orderNumber: order.orderNumber,
    }).catch(() => {});
  }

  return NextResponse.json({
    balanceStatus: order.balanceStatus,
    remainingBalance: order.remainingBalance,
    paymentStatus: order.paymentStatus,
    advancePaid: order.advancePaid,
    balancePaid: order.balancePaid,
  });
}

/** Verify (or unverify) an existing payment without changing paidAt. */
export async function PATCH(req, { params }) {
  const { error, access } = await requireAdminPermission('orders', 'write');
  if (error) return error;
  await dbConnect();
  const order = await Order.findById(params.id);
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  if (!assertCanAccessOrder(access, order)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const paymentId = String(body.paymentId || '');
  if (!paymentId) return NextResponse.json({ error: 'paymentId required' }, { status: 400 });

  const record = (order.paymentRecords || []).id(paymentId)
    || (order.paymentRecords || []).find((r) => String(r._id) === paymentId);
  if (!record) return NextResponse.json({ error: 'Payment record not found' }, { status: 404 });

  const originalPaidAt = record.paidAt;
  if (body.rejected === true) {
    record.rejected = true;
    record.verified = false;
    record.verifiedBy = undefined;
    record.verifiedAt = undefined;
    record.rejectedBy = access.adminId;
    record.rejectedAt = new Date();
  } else if (body.verified === true) {
    record.rejected = false;
    record.rejectedBy = undefined;
    record.rejectedAt = undefined;
    record.verified = true;
    record.verifiedBy = access.adminId;
    record.verifiedAt = new Date();
  } else if (body.verified === false) {
    record.verified = false;
    record.verifiedBy = undefined;
    record.verifiedAt = undefined;
  }
  // Always restore original receipt time — never accept body.paidAt on verify
  record.paidAt = originalPaidAt;

  if (record.kind === 'revision' && record.verified) {
    order.revisionPaymentVerified = true;
  }

  refreshPaymentTotals(order);
  appendTimeline(order, {
    type: 'payment_verified',
    newStatus: order.balanceStatus,
    employee: access.adminId,
    employeeName: access.name || access.email || '',
    notes: `${record.kind} ₹${record.amount} verification updated (paidAt preserved)`,
  });
  await order.save();

  await logAdminAudit({
    access,
    req,
    action: 'orders.payment_verify',
    targetType: 'Order',
    targetId: String(order._id),
    details: { paymentId, verified: record.verified, paidAt: record.paidAt, orderNumber: order.orderNumber },
  });

  return NextResponse.json({
    balanceStatus: order.balanceStatus,
    remainingBalance: order.remainingBalance,
    paymentStatus: order.paymentStatus,
    advancePaid: order.advancePaid,
    balancePaid: order.balancePaid,
  });
}
