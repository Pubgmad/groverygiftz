import OpsNotification from '@/models/OpsNotification';
import { computeBalanceStatus } from '@/lib/opsConstants';

export function appendTimeline(order, {
  type,
  previousStatus = '',
  newStatus = '',
  employee = null,
  employeeName = '',
  notes = '',
  fileRef = '',
} = {}) {
  if (!order.timeline) order.timeline = [];
  order.timeline.push({
    type,
    previousStatus,
    newStatus,
    employee: employee || undefined,
    employeeName: employeeName || '',
    notes: notes || '',
    fileRef: fileRef || '',
    at: new Date(),
  });
}

export function refreshPaymentTotals(order) {
  const records = Array.isArray(order.paymentRecords) ? order.paymentRecords : [];
  let advance = 0;
  let balance = 0;
  let revision = 0;
  let needsVerification = false;
  records.forEach((row) => {
    const amount = Number(row.amount) || 0;
    if (!row.verified) needsVerification = true;
    if (row.kind === 'balance') balance += amount;
    else if (row.kind === 'revision') revision += amount;
    else advance += amount;
  });
  order.advancePaid = advance;
  order.balancePaid = balance;
  order.revisionCharges = Math.max(Number(order.revisionCharges) || 0, revision);
  order.additionalCharges = Number(order.additionalCharges) || 0;
  const owed = Math.max(0, Number(order.total || 0) + Number(order.additionalCharges || 0) + Number(order.revisionCharges || 0));
  const paid = advance + balance;
  order.remainingBalance = Math.max(0, Math.round((owed - paid) * 100) / 100);
  order.balanceStatus = computeBalanceStatus({
    total: order.total,
    advancePaid: advance,
    additionalCharges: Number(order.additionalCharges || 0) + Number(order.revisionCharges || 0),
    balancePaid: balance,
    verificationRequired: needsVerification && paid > 0 && paid < owed,
  });
  if (order.balanceStatus === 'fully_paid' && order.paymentStatus !== 'refunded') {
    order.paymentStatus = 'paid';
    if (!order.paidAt) order.paidAt = new Date();
  }
  return order;
}

export async function notifyAdmins(recipientIds = [], payload = {}) {
  const ids = [...new Set((recipientIds || []).filter(Boolean).map((id) => String(id)))];
  if (!ids.length) return;
  await OpsNotification.insertMany(
    ids.map((recipient) => ({
      recipient,
      type: payload.type || 'ops',
      title: payload.title || 'Operations update',
      body: payload.body || '',
      order: payload.order || undefined,
      orderNumber: payload.orderNumber || '',
      task: payload.task || undefined,
      meta: payload.meta || {},
    })),
  );
}

export function sanitizePublicDesignOrder(order) {
  if (!order) return null;
  const versions = Array.isArray(order.designVersions) ? order.designVersions : [];
  const current = versions.find((v) => Number(v.version) === Number(order.currentDesignVersion)) || versions[versions.length - 1];
  return {
    orderNumber: order.orderNumber,
    previewRequired: order.previewRequired !== false,
    designApprovalStatus: order.designApprovalStatus,
    currentDesignVersion: order.currentDesignVersion,
    designChangeRequest: order.designChangeRequest || '',
    customerName: order.shippingAddress?.fullName || '',
    design: current
      ? {
        version: current.version,
        url: current.url,
        uploadedAt: current.uploadedAt,
        notes: current.notes || '',
      }
      : null,
  };
}
