/** Operational workflow states for GroveryGiftz Admin Operations. */
export const OPS_STATUSES = [
  'new_order',
  'design_pending',
  'editing_in_progress',
  'preview_waiting',
  'revision_required',
  'approved_printing_pending',
  'printing_assigned',
  'printing_in_progress',
  'printing_completed',
  'manufacturing',
  'assembly',
  'finishing',
  'production_pending',
  'production_in_progress',
  'quality_check',
  'packing_pending',
  'ready_to_dispatch',
  'dispatched',
  'tracking_pending',
  'completed',
  'on_hold',
];

export const OPS_STATUS_LABELS = {
  new_order: 'New Orders',
  design_pending: 'Design Pending',
  editing_in_progress: 'Editing in Progress',
  preview_waiting: 'Preview Waiting for Customer',
  revision_required: 'Revision Required',
  approved_printing_pending: 'Approved — Printing Pending',
  printing_assigned: 'Printing Assigned',
  printing_in_progress: 'Printing In Progress',
  printing_completed: 'Printing Completed',
  manufacturing: 'Manufacturing',
  assembly: 'Assembly',
  finishing: 'Finishing',
  production_pending: 'Production Pending',
  production_in_progress: 'Production In Progress',
  quality_check: 'Quality Check',
  packing_pending: 'Packing Pending',
  ready_to_dispatch: 'Ready to Dispatch',
  dispatched: 'Dispatched',
  tracking_pending: 'Tracking Pending',
  completed: 'Completed',
  on_hold: 'On Hold',
};

/** Short tooltips for Operations board status chips. */
export const OPS_STATUS_HELP = {
  new_order: 'Newly created orders waiting to enter design/editing.',
  design_pending: 'Assigned for design; work not started or awaiting assets.',
  editing_in_progress: 'Editor is actively working on the design.',
  preview_waiting: 'Design sent; waiting for customer approval.',
  revision_required: 'Customer requested changes.',
  approved_printing_pending: 'Design approved; waiting to start print.',
  printing_assigned: 'Print job assigned to a printer.',
  printing_in_progress: 'Printing sheets in progress.',
  printing_completed: 'Printing finished; ready for production.',
  manufacturing: 'Frame / product manufacturing step.',
  assembly: 'Assembly of printed sheets into product.',
  finishing: 'Finishing touches before QC.',
  production_pending: 'Queued for production.',
  production_in_progress: 'Production team working on the order.',
  quality_check: 'Quality check before packing.',
  packing_pending: 'Ready to pack / packing in progress.',
  ready_to_dispatch: 'Packed and ready for courier handover.',
  dispatched: 'Handed to courier (actual dispatch recorded).',
  tracking_pending: 'Dispatched; tracking ID still being updated.',
  completed: 'Order fully completed.',
  on_hold: 'Paused — not progressing until released.',
};

/** Allowed next ops statuses (linear flow + on_hold from most; recovery from on_hold). */
export const OPS_TRANSITIONS = {
  new_order: ['design_pending', 'editing_in_progress', 'preview_waiting', 'approved_printing_pending', 'on_hold'],
  design_pending: ['editing_in_progress', 'preview_waiting', 'revision_required', 'on_hold'],
  editing_in_progress: ['preview_waiting', 'revision_required', 'approved_printing_pending', 'on_hold'],
  preview_waiting: ['revision_required', 'approved_printing_pending', 'editing_in_progress', 'on_hold'],
  revision_required: ['editing_in_progress', 'preview_waiting', 'design_pending', 'on_hold'],
  approved_printing_pending: ['printing_assigned', 'printing_in_progress', 'on_hold'],
  printing_assigned: ['printing_in_progress', 'approved_printing_pending', 'on_hold'],
  printing_in_progress: ['printing_completed', 'manufacturing', 'on_hold'],
  printing_completed: ['manufacturing', 'production_pending', 'assembly', 'on_hold'],
  manufacturing: ['assembly', 'finishing', 'production_in_progress', 'quality_check', 'on_hold'],
  assembly: ['finishing', 'quality_check', 'packing_pending', 'on_hold'],
  finishing: ['quality_check', 'packing_pending', 'on_hold'],
  production_pending: ['production_in_progress', 'manufacturing', 'assembly', 'on_hold'],
  production_in_progress: ['assembly', 'finishing', 'quality_check', 'on_hold'],
  quality_check: ['packing_pending', 'production_in_progress', 'finishing', 'on_hold'],
  packing_pending: ['ready_to_dispatch', 'quality_check', 'on_hold'],
  ready_to_dispatch: ['dispatched', 'tracking_pending', 'packing_pending', 'on_hold'],
  dispatched: ['tracking_pending', 'completed', 'on_hold'],
  tracking_pending: ['completed', 'dispatched', 'on_hold'],
  completed: [],
  on_hold: [
    'new_order',
    'design_pending',
    'editing_in_progress',
    'preview_waiting',
    'revision_required',
    'approved_printing_pending',
    'printing_assigned',
    'printing_in_progress',
    'printing_completed',
    'manufacturing',
    'assembly',
    'finishing',
    'production_pending',
    'production_in_progress',
    'quality_check',
    'packing_pending',
    'ready_to_dispatch',
  ],
};

export function canTransitionOpsStatus(from, to) {
  if (!to) return false;
  if (!OPS_STATUSES.includes(to)) return false;
  if (!from || from === to) return true;
  const allowed = OPS_TRANSITIONS[from];
  if (!Array.isArray(allowed)) return false;
  return allowed.includes(to);
}

/** Current status plus allowed next statuses (for UI selects / quick actions). */
export function allowedOpsStatusesFor(from) {
  const current = from && OPS_STATUSES.includes(from) ? from : 'new_order';
  const next = OPS_TRANSITIONS[current] || [];
  return [current, ...next.filter((s) => s !== current)];
}

export const DESIGN_APPROVAL_STATUSES = [
  'not_uploaded',
  'awaiting_approval',
  'changes_requested',
  'approved',
  'rejected',
];

export const DESIGN_APPROVAL_LABELS = {
  not_uploaded: 'Not Uploaded',
  awaiting_approval: 'Awaiting Approval',
  changes_requested: 'Changes Requested',
  approved: 'Approved',
  rejected: 'Rejected',
};

export const ORDER_SOURCES = ['website', 'whatsapp', 'instagram'];

export const ORDER_SOURCE_LABELS = {
  website: 'Website',
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
};

export const PAYMENT_BALANCE_STATUSES = [
  'pending',
  'partially_paid',
  'fully_paid',
  'verification_required',
];

export const TASK_TYPES = [
  'sales',
  'editing',
  'printing',
  'production',
  'packing',
  'dispatch',
  'admin',
  'other',
];

/** Board chips to hide (legacy category removed from workflow UI; status kept for history). */
export const HIDDEN_OPS_BOARD_STATUSES = ['printing_assigned'];

export const TASK_PRIORITIES = ['low', 'normal', 'high', 'urgent'];

export const TASK_STATUSES = ['pending', 'in_progress', 'completed', 'cancelled', 'blocked'];

/** Printing started or later — blocks customer photo replacement. */
export const PRINTING_STARTED_OPS = new Set([
  'printing_assigned',
  'printing_in_progress',
  'printing_completed',
  'manufacturing',
  'assembly',
  'finishing',
  'production_pending',
  'production_in_progress',
  'quality_check',
  'packing_pending',
  'ready_to_dispatch',
  'dispatched',
  'tracking_pending',
  'completed',
]);

const PRINT_BLOCKED_OPS = new Set([
  'printing_assigned',
  'printing_in_progress',
  'printing_completed',
  'approved_printing_pending',
]);

const PRODUCTION_BLOCKED_OPS = new Set([
  'printing_assigned',
  'printing_in_progress',
  'printing_completed',
  'manufacturing',
  'assembly',
  'finishing',
  'production_pending',
  'production_in_progress',
]);

const PAYMENT_GATED_OPS = new Set([
  'ready_to_dispatch',
  'dispatched',
  'tracking_pending',
  'completed',
]);

export function isPrintOpsStatus(status) {
  return PRINT_BLOCKED_OPS.has(status);
}

export function isProductionOpsStatus(status) {
  return PRODUCTION_BLOCKED_OPS.has(status);
}

export function isPaymentGatedOpsStatus(status) {
  return PAYMENT_GATED_OPS.has(status);
}

export const DISPATCH_PAYMENT_REQUIRED_OPS = PAYMENT_GATED_OPS;

export function isPaymentSatisfiedForDispatch(order = {}) {
  if (order.paymentException === true) return true;
  if (order.balanceStatus === 'fully_paid') return true;
  // When paymentRecords exist, trust verified totals (balanceStatus) — not sticky paymentStatus
  if (Array.isArray(order.paymentRecords) && order.paymentRecords.length > 0) {
    return false;
  }
  // Legacy website / Cashfree: paid without paymentRecords
  return order.paymentStatus === 'paid';
}

/** Paid revision required after free revision already used and a second change request. */
export function requiresPaidRevisionGate(order = {}) {
  return Boolean(order.freeRevisionUsed)
    && !order.revisionPaymentVerified
    && Number(order.designRevisionCount || 0) > 1;
}

export function isDelayedOrder(order, now = new Date()) {
  if (!order?.expectedDispatchDate) return false;
  if (['dispatched', 'completed', 'cancelled'].includes(String(order.status || ''))) return false;
  if (['dispatched', 'completed'].includes(String(order.opsStatus || ''))) return false;
  const due = new Date(order.expectedDispatchDate);
  if (Number.isNaN(due.getTime())) return false;
  // Treat date-only expectations as end of that IST calendar day
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(due.getTime() + istOffset);
  const endIstUtc = Date.UTC(
    ist.getUTCFullYear(),
    ist.getUTCMonth(),
    ist.getUTCDate(),
    23, 59, 59, 999,
  ) - istOffset;
  return endIstUtc < now.getTime();
}

export function computeBalanceStatus({ total = 0, advancePaid = 0, additionalCharges = 0, balancePaid = 0, verificationRequired = false } = {}) {
  if (verificationRequired) return 'verification_required';
  const owed = Math.max(0, Number(total || 0) + Number(additionalCharges || 0));
  const paid = Math.max(0, Number(advancePaid || 0) + Number(balancePaid || 0));
  if (owed <= 0) return paid > 0 ? 'fully_paid' : 'pending';
  if (paid <= 0) return 'pending';
  if (paid + 0.009 >= owed) return 'fully_paid';
  return 'partially_paid';
}

/** Latest design version per sheetNumber (default sheet 1 for legacy uploads). */
export function getLatestDesignVersionsBySheet(order = {}) {
  const versions = Array.isArray(order.designVersions) ? order.designVersions : [];
  const bySheet = new Map();
  versions.forEach((v) => {
    const sheetNumber = Math.max(1, Number(v?.sheetNumber) || 1);
    const prev = bySheet.get(sheetNumber);
    if (!prev || Number(v.version) > Number(prev.version)) {
      bySheet.set(sheetNumber, v);
    }
  });
  return [...bySheet.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([sheetNumber, version]) => ({
      sheetNumber,
      sheetLabel: String(version?.sheetLabel || `Sheet ${sheetNumber}`),
      version,
      versionNumber: Number(version?.version) || 0,
      url: version?.url || '',
      linkedItemIndexes: Array.isArray(version?.linkedItemIndexes) ? version.linkedItemIndexes : [],
      linkedLabels: Array.isArray(version?.linkedLabels) ? version.linkedLabels : [],
    }));
}

export function getSheetApproval(order = {}, sheetNumber = 1) {
  const n = Math.max(1, Number(sheetNumber) || 1);
  const rows = Array.isArray(order.designSheetApprovals) ? order.designSheetApprovals : [];
  return rows.find((row) => Number(row?.sheetNumber) === n) || null;
}

/**
 * Sync order-level designApprovalStatus from per-sheet approvals.
 * Mutates order in place when provided as a mongoose doc / plain object.
 */
export function syncDesignApprovalFromSheets(order = {}) {
  const sheets = getLatestDesignVersionsBySheet(order);
  if (!sheets.length) {
    order.designApprovalStatus = 'not_uploaded';
    order.designApprovedVersion = 0;
    return order;
  }

  const previewRequired = order.previewRequired !== false && order.previewRequired !== 'no';
  if (!previewRequired) {
    order.designApprovalStatus = 'approved';
    order.designApprovedVersion = Number(order.currentDesignVersion) || sheets[sheets.length - 1].versionNumber;
    if (!order.designApprovedAt) order.designApprovedAt = new Date();
    return order;
  }

  const approvals = Array.isArray(order.designSheetApprovals) ? order.designSheetApprovals : [];
  const allApproved = sheets.every((sheet) => {
    const appr = approvals.find((row) => Number(row?.sheetNumber) === Number(sheet.sheetNumber));
    return appr
      && appr.status === 'approved'
      && Number(appr.approvedVersion || 0) === Number(sheet.versionNumber);
  });
  const anyChanges = approvals.some((row) => row?.status === 'changes_requested');
  const anyRejected = approvals.some((row) => row?.status === 'rejected');

  if (allApproved) {
    order.designApprovalStatus = 'approved';
    order.designApprovedVersion = Number(order.currentDesignVersion) || 0;
    order.designApprovedAt = new Date();
  } else if (anyRejected) {
    order.designApprovalStatus = 'rejected';
  } else if (anyChanges) {
    order.designApprovalStatus = 'changes_requested';
  } else {
    order.designApprovalStatus = 'awaiting_approval';
    order.designApprovedVersion = 0;
  }
  return order;
}

/** Design printing (not shipping labels). Preview Required=No needs an uploaded design. */
export function canPrintDesign(order = {}) {
  const versions = Array.isArray(order.designVersions) ? order.designVersions : [];
  const hasDesign = Number(order.currentDesignVersion || 0) > 0 || versions.length > 0;
  if (!hasDesign) return false;
  const previewRequired = order.previewRequired !== false && order.previewRequired !== 'no';
  if (!previewRequired) return true;

  const approvals = Array.isArray(order.designSheetApprovals) ? order.designSheetApprovals : [];
  const usesMultiSheetMeta = approvals.length > 0
    || versions.some((v) => Number(v?.sheetNumber || 1) > 1)
    || versions.some((v) => String(v?.sheetLabel || '').trim());

  // Legacy / single-file orders without sheet metadata
  if (!usesMultiSheetMeta) {
    return (
      order.designApprovalStatus === 'approved'
      && Number(order.designApprovedVersion || 0) === Number(order.currentDesignVersion || 0)
    );
  }

  const sheets = getLatestDesignVersionsBySheet(order);
  if (!sheets.length) return false;

  return sheets.every((sheet) => {
    const appr = approvals.find((row) => Number(row?.sheetNumber) === Number(sheet.sheetNumber));
    return appr
      && appr.status === 'approved'
      && Number(appr.approvedVersion || 0) === Number(sheet.versionNumber);
  });
}

export const SALES_COMMS_KEYS = [
  'previewShared',
  'approvalReceived',
  'videoShared',
  'balanceRequested',
  'dispatchCommunicated',
  'trackingShared',
];

export const SALES_COMMS_LABELS = {
  previewShared: 'Design preview shared',
  approvalReceived: 'Customer approval received',
  videoShared: 'Product completion video shared',
  balanceRequested: 'Balance payment requested',
  dispatchCommunicated: 'Dispatch information communicated',
  trackingShared: 'Tracking details shared',
};
