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
 *
 * Legacy website Cashfree: empty paymentRecords + paymentStatus paid → fully_paid
 * (preserves remainingBalance / paidAt; never invents dates).
 * Call ensureLegacyWebsitePaymentRecord before refresh when adding new records.
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
  const nextAdditional = Number(additionalCharges) || 0;
  let revisionCharged = Number(revisionCharges) || 0;
  const owedBase = Math.max(0, Number(total || 0) + nextAdditional + revisionCharged);

  // Legacy Cashfree / website: paid with no paymentRecords — do not corrupt on ops save
  if (!records.length && paymentStatus === 'paid') {
    return {
      advancePaid: owedBase,
      balancePaid: 0,
      revisionCharges: revisionCharged,
      additionalCharges: nextAdditional,
      remainingBalance: 0,
      balanceStatus: 'fully_paid',
      paymentStatus: 'paid',
      paidAt: paidAt || null,
      revisionPaymentVerified,
      paid: owedBase,
      owed: owedBase,
      verificationRequired: false,
      hasUnverifiedPositive: false,
    };
  }

  let advance = 0;
  let balance = 0;
  let revisionPaid = 0;
  let hasUnverifiedPositive = false;
  let hasVerifiedPositive = false;

  records.forEach((row) => {
    const amount = Number(row?.amount) || 0;
    if (row?.kind === 'revision') {
      revisionCharged = Math.max(revisionCharged, amount);
    }
    if (!row?.verified) {
      if (amount > 0) hasUnverifiedPositive = true;
      return;
    }
    if (amount > 0) hasVerifiedPositive = true;
    if (row.kind === 'balance') balance += amount;
    else if (row.kind === 'revision') revisionPaid += amount;
    else advance += amount;
  });

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

  if (paymentStatus === 'refunded') {
    // leave refunded alone
  } else if (balanceStatus === 'fully_paid') {
    nextPaymentStatus = 'paid';
    const earliest = records
      .filter((r) => r?.verified && r.paidAt && (Number(r.amount) || 0) > 0)
      .map((r) => new Date(r.paidAt).getTime())
      .filter((t) => Number.isFinite(t))
      .sort((a, b) => a - b)[0];
    if (earliest) nextPaidAt = new Date(earliest);
    // else keep existing paidAt — never invent "now"
  } else if (hasVerifiedPositive) {
    // Verified totals no longer cover owed — demote sticky paid
    nextPaymentStatus = 'pending';
    nextPaidAt = null;
  } else if (paymentStatus === 'paid' && paidAt && !hasVerifiedPositive) {
    // Unverified-only extras on a paid legacy order: keep paid/paidAt
    // (refreshPaymentTotals backfills a verified website record first)
    nextPaymentStatus = 'paid';
    nextPaidAt = paidAt;
  } else if (paymentStatus === 'paid' && !hasVerifiedPositive) {
    nextPaymentStatus = 'pending';
    nextPaidAt = null;
  }

  const nextRevisionVerified = revisionPaid > 0 && revisionPaid + 0.009 >= revisionCharged
    ? true
    : revisionPaymentVerified;

  return {
    advancePaid: advance,
    balancePaid: balance,
    revisionCharges: revisionCharged,
    additionalCharges: nextAdditional,
    remainingBalance: (paymentStatus === 'paid' && paidAt && !hasVerifiedPositive && balanceStatus !== 'fully_paid')
      ? 0
      : remainingBalance,
    balanceStatus: (paymentStatus === 'paid' && paidAt && !hasVerifiedPositive && balanceStatus !== 'fully_paid')
      ? (verificationRequired ? 'verification_required' : 'fully_paid')
      : balanceStatus,
    paymentStatus: nextPaymentStatus,
    paidAt: nextPaidAt,
    revisionPaymentVerified: nextRevisionVerified,
    paid: (paymentStatus === 'paid' && paidAt && !hasVerifiedPositive) ? owed : paid,
    owed,
    verificationRequired,
    hasUnverifiedPositive,
  };
}

/**
 * Backfill a verified Cashfree/website paymentRecord from existing order.paidAt only.
 * Never invents dates. Safe to call before refreshPaymentTotals on ops/payment paths.
 */
export function ensureLegacyWebsitePaymentRecord(order) {
  if (!order) return false;
  if (order.paymentStatus !== 'paid') return false;
  if (!order.paidAt) return false;
  const records = Array.isArray(order.paymentRecords) ? order.paymentRecords : [];
  if (records.some((r) => r?.verified && (Number(r.amount) || 0) > 0)) return false;
  const amount = Number(order.total) || 0;
  if (amount <= 0) return false;
  const paidAt = new Date(order.paidAt);
  if (Number.isNaN(paidAt.getTime())) return false;
  if (!order.paymentRecords) order.paymentRecords = [];
  order.paymentRecords.push({
    kind: 'advance',
    amount,
    method: order.paymentMethod || 'Cashfree',
    reference: order.cashfreePaymentId || order.cashfreeOrderId || '',
    paidAt,
    verified: true,
    verifiedAt: paidAt,
    notes: 'Website Cashfree payment',
    recordedByName: 'Website checkout',
  });
  return true;
}

export function refreshPaymentTotals(order) {
  ensureLegacyWebsitePaymentRecord(order);
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
  if (totals.paymentStatus === 'paid') {
    if (totals.paidAt) order.paidAt = totals.paidAt;
  } else if (totals.paymentStatus !== 'refunded') {
    // Clear order-level paidAt when no longer fully paid; per-record paidAt history stays intact
    order.paidAt = undefined;
  }
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
