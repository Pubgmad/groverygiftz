export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Order from '@/models/Order';
import { requireAdminPermission, logAdminAudit } from '@/lib/adminAccess';
import { saveUploadFile } from '@/lib/uploadStorage';
import { appendTimeline, refreshPaymentTotals, notifyAdmins } from '@/lib/opsOrderHelpers';
import { assertCanAccessOrder } from '@/lib/opsStaffAccess';

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
  let amount; let kind; let method; let reference; let paidAt; let notes; let verified = false; let screenshotPath; let screenshotUrl;

  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData();
    amount = Number(form.get('amount'));
    kind = String(form.get('kind') || 'advance');
    method = String(form.get('method') || '').trim();
    reference = String(form.get('reference') || '').trim();
    paidAt = form.get('paidAt') ? new Date(String(form.get('paidAt'))) : new Date();
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
    paidAt = body.paidAt ? new Date(body.paidAt) : new Date();
    notes = String(body.notes || '').trim();
    verified = body.verified === true;
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Valid payment amount is required' }, { status: 400 });
  }
  if (!['advance', 'balance', 'revision', 'other'].includes(kind)) {
    return NextResponse.json({ error: 'Invalid payment kind' }, { status: 400 });
  }

  order.paymentRecords = order.paymentRecords || [];
  order.paymentRecords.push({
    kind,
    amount,
    method,
    reference,
    screenshotPath,
    screenshotUrl,
    paidAt,
    verified,
    verifiedBy: verified ? access.adminId : undefined,
    verifiedAt: verified ? new Date() : undefined,
    notes,
    recordedBy: access.adminId,
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
