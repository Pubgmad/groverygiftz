/** Operational workflow states for GroveryGiftz Admin Operations. */
export const OPS_STATUSES = [
  'new_order',
  'design_pending',
  'editing_in_progress',
  'preview_waiting',
  'revision_required',
  'approved_printing_pending',
  'printing_in_progress',
  'printing_completed',
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
  printing_in_progress: 'Printing In Progress',
  printing_completed: 'Printing Completed',
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
];

export const TASK_PRIORITIES = ['low', 'normal', 'high', 'urgent'];

export const TASK_STATUSES = ['pending', 'in_progress', 'completed', 'cancelled', 'blocked'];

/** Printing started or later — blocks customer photo replacement. */
export const PRINTING_STARTED_OPS = new Set([
  'printing_in_progress',
  'printing_completed',
  'production_pending',
  'production_in_progress',
  'quality_check',
  'packing_pending',
  'ready_to_dispatch',
  'dispatched',
  'tracking_pending',
  'completed',
]);

export function isDelayedOrder(order, now = new Date()) {
  if (!order?.expectedDispatchDate) return false;
  if (['dispatched', 'completed', 'cancelled'].includes(String(order.status || ''))) return false;
  if (['dispatched', 'completed'].includes(String(order.opsStatus || ''))) return false;
  const due = new Date(order.expectedDispatchDate);
  if (Number.isNaN(due.getTime())) return false;
  return due.getTime() < now.getTime();
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

/** Design printing (not shipping labels). Preview Required=No needs an uploaded design. */
export function canPrintDesign(order = {}) {
  const hasDesign = Number(order.currentDesignVersion || 0) > 0;
  if (!hasDesign) return false;
  const previewRequired = order.previewRequired !== false && order.previewRequired !== 'no';
  if (!previewRequired) return true;
  return (
    order.designApprovalStatus === 'approved'
    && Number(order.designApprovedVersion || 0) === Number(order.currentDesignVersion || 0)
  );
}
