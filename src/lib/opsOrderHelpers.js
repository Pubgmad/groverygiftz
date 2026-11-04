import OpsNotification from '@/models/OpsNotification';
import Admin from '@/models/Admin';
import Role from '@/models/Role';
import {
  computeBalanceStatus,
  getLatestDesignVersionsBySheet,
  syncDesignApprovalFromSheets,
} from '@/lib/opsConstants';

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

/**
 * Pure payment totals — only VERIFIED records credit paid amounts.
 * Unverified screenshots never inflate paid balances.
 * Verified revision payments reduce remaining balance.
 */
export function computePaymentTotals({
  total = 0,
  additionalCharges = 0,
  revisionCharges = 0,
  paymentRecords = [],
  paymentStatus = '',
  paidAt = null,
  revisionPaymentVerified = false,
} = {}) {
  const records = Array.isArray(paymentRecords) ? paymentRecords : [];
  let advance = 0;
  let balance = 0;
  let revisionPaid = 0;
  let revisionCharged = Number(revisionCharges) || 0;
  let hasUnverifiedPositive = false;

  records.forEach((row) => {
    const amount = Number(row?.amount) || 0;
    if (row?.kind === 'revision') {
      revisionCharged = Math.max(revisionCharged, amount);
    }
    if (!row?.verified) {
      if (amount > 0) hasUnverifiedPositive = true;
      return;
    }
    if (row.kind === 'balance') balance += amount;
    else if (row.kind === 'revision') revisionPaid += amount;
    else advance += amount;
  });

  const nextAdditional = Number(additionalCharges) || 0;
  const owed = Math.max(0, Number(total || 0) + nextAdditional + revisionCharged);
  const paid = advance + balance + revisionPaid;
  const remainingBalance = Math.max(0, Math.round((owed - paid) * 100) / 100);
  const verificationRequired = hasUnverifiedPositive && (paid + 0.009 < owed || paid <= 0);

  const balanceStatus = computeBalanceStatus({
    total,
    advancePaid: advance,
    additionalCharges: nextAdditional + revisionCharged,
    balancePaid: balance + revisionPaid,
    verificationRequired,
  });

  let nextPaymentStatus = paymentStatus;
  let nextPaidAt = paidAt;
  if (balanceStatus === 'fully_paid' && paymentStatus !== 'refunded') {
    nextPaymentStatus = 'paid';
    if (!nextPaidAt) nextPaidAt = new Date();
  } else if (balanceStatus === 'verification_required') {
    // Do not treat unpaid/unverified as paid
    if (paymentStatus === 'paid' && !records.some((r) => r.verified && (Number(r.amount) || 0) > 0)) {
      nextPaymentStatus = 'pending';
    }
  }

  const nextRevisionVerified = revisionPaid > 0 && revisionPaid + 0.009 >= revisionCharged
    ? true
    : revisionPaymentVerified;

  return {
    advancePaid: advance,
    balancePaid: balance,
    revisionCharges: revisionCharged,
    additionalCharges: nextAdditional,
    remainingBalance,
    balanceStatus,
    paymentStatus: nextPaymentStatus,
    paidAt: nextPaidAt,
    revisionPaymentVerified: nextRevisionVerified,
    paid,
    owed,
    verificationRequired,
    hasUnverifiedPositive,
  };
}

export function refreshPaymentTotals(order) {
  const totals = computePaymentTotals({
    total: order.total,
    additionalCharges: order.additionalCharges,
    revisionCharges: order.revisionCharges,
    paymentRecords: order.paymentRecords,
    paymentStatus: order.paymentStatus,
    paidAt: order.paidAt,
    revisionPaymentVerified: order.revisionPaymentVerified,
  });
  order.advancePaid = totals.advancePaid;
  order.balancePaid = totals.balancePaid;
  order.revisionCharges = totals.revisionCharges;
  order.additionalCharges = totals.additionalCharges;
  order.remainingBalance = totals.remainingBalance;
  order.balanceStatus = totals.balanceStatus;
  order.paymentStatus = totals.paymentStatus;
  if (totals.paidAt) order.paidAt = totals.paidAt;
  if (totals.revisionPaymentVerified) order.revisionPaymentVerified = true;
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

/** Notify all active admins assigned to roles with matching slugs (e.g. sales-person). */
export async function notifyRoleSlugs(slugs = [], payload = {}) {
  const wanted = new Set((slugs || []).map((s) => String(s || '').toLowerCase()).filter(Boolean));
  if (!wanted.size) return;
  const roles = await Role.find({ slug: { $in: [...wanted] }, isActive: { $ne: false } }).select('_id').lean();
  const roleIds = roles.map((r) => r._id);
  if (!roleIds.length) return;
  const staff = await Admin.find({
    isActive: { $ne: false },
    roleId: { $in: roleIds },
  }).select('_id').lean();
  const ids = staff.map((s) => s._id);
  if (payload.alsoInclude) ids.push(...payload.alsoInclude);
  await notifyAdmins(ids, payload);
}

export function sanitizePublicDesignOrder(order) {
  if (!order) return null;
  const versions = Array.isArray(order.designVersions) ? order.designVersions : [];
  const current = versions.find((v) => Number(v.version) === Number(order.currentDesignVersion)) || versions[versions.length - 1];
  const sheets = getLatestDesignVersionsBySheet(order).map((sheet) => ({
    sheetNumber: sheet.sheetNumber,
    sheetLabel: sheet.sheetLabel,
    version: sheet.versionNumber,
    url: sheet.url,
    linkedLabels: sheet.linkedLabels,
    approval: (Array.isArray(order.designSheetApprovals) ? order.designSheetApprovals : [])
      .find((row) => Number(row?.sheetNumber) === Number(sheet.sheetNumber)) || null,
  }));
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
        sheetNumber: Math.max(1, Number(current.sheetNumber) || 1),
        sheetLabel: current.sheetLabel || '',
        url: current.url,
        uploadedAt: current.uploadedAt,
        notes: current.notes || '',
      }
      : null,
    sheets,
  };
}

/** Invalidate approval for one sheet after a new upload; sync order-level status. */
export function invalidateSheetApproval(order, sheetNumber, { awaiting = true } = {}) {
  const n = Math.max(1, Number(sheetNumber) || 1);
  order.designSheetApprovals = Array.isArray(order.designSheetApprovals) ? order.designSheetApprovals : [];
  const idx = order.designSheetApprovals.findIndex((row) => Number(row?.sheetNumber) === n);
  const next = {
    sheetNumber: n,
    status: awaiting ? 'awaiting_approval' : 'not_uploaded',
    approvedVersion: 0,
    approvedAt: undefined,
    source: 'system',
  };
  if (idx >= 0) order.designSheetApprovals[idx] = { ...order.designSheetApprovals[idx], ...next };
  else order.designSheetApprovals.push(next);
  syncDesignApprovalFromSheets(order);
  return order;
}

/** Mark every current sheet as approved (customer or admin). */
export function approveAllCurrentSheets(order, { source = 'customer', evidence = '' } = {}) {
  const sheets = getLatestDesignVersionsBySheet(order);
  order.designSheetApprovals = Array.isArray(order.designSheetApprovals) ? order.designSheetApprovals : [];
  sheets.forEach((sheet) => {
    const idx = order.designSheetApprovals.findIndex((row) => Number(row?.sheetNumber) === Number(sheet.sheetNumber));
    const row = {
      sheetNumber: sheet.sheetNumber,
      status: 'approved',
      approvedVersion: sheet.versionNumber,
      approvedAt: new Date(),
      source,
    };
    if (idx >= 0) order.designSheetApprovals[idx] = { ...order.designSheetApprovals[idx], ...row };
    else order.designSheetApprovals.push(row);
  });
  syncDesignApprovalFromSheets(order);
  if (evidence) {
    // evidence recorded by caller in designApprovalHistory
  }
  return order;
}
