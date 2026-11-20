/**
 * Lean Admin order projections.
 * List/status paths must not pull customization photos, design versions,
 * production videos, timeline blobs, or other heavy item payloads.
 */

export const ADMIN_ORDER_LIST_SELECT = [
  'orderNumber',
  'orderSource',
  'orderPriority',
  'status',
  'paymentStatus',
  'paymentMethod',
  'balanceStatus',
  'total',
  'subtotal',
  'shippingCost',
  'createdAt',
  'updatedAt',
  'paidAt',
  'opsStatus',
  'assignedTo',
  'assignedToName',
  'expectedDispatchDate',
  'previewRequired',
  'guestEmail',
  'trackingNumber',
  'trackingUrl',
  'courierCompany',
  'dispatchDate',
  'pickupStatus',
  'isOutOfTamilNadu',
  'deliveryEstimate',
  'designApprovalStatus',
  'confirmationSchedule.expectedReadyDateIst',
  'confirmationSchedule.estimatedDeliveryDateIst',
  'confirmationSchedule.shippingEstimateLabel',
  'shippingAddress.fullName',
  'shippingAddress.email',
  'shippingAddress.phone',
  'shippingAddress.whatsappNumber',
  'shippingAddress.city',
  'shippingAddress.state',
  'shippingAddress.pincode',
  'shippingAddress.line1',
  'shippingAddress.line2',
].join(' ');

export const SHIPPING_LABEL_ORDER_SELECT = [
  'orderNumber',
  'status',
  'paymentStatus',
  'paidAt',
  'createdAt',
  'shippingAddress',
  'items.title',
  'items.quantity',
  'items.variant',
].join(' ');

/** Patch only list-safe / status fields onto an existing selected detail object. */
export function pickAdminOrderListPatch(order = {}) {
  return {
    status: order.status,
    paymentStatus: order.paymentStatus,
    balanceStatus: order.balanceStatus,
    opsStatus: order.opsStatus,
    assignedTo: order.assignedTo,
    assignedToName: order.assignedToName,
    expectedDispatchDate: order.expectedDispatchDate,
    trackingNumber: order.trackingNumber,
    trackingUrl: order.trackingUrl,
    courierCompany: order.courierCompany,
    dispatchDate: order.dispatchDate,
    pickupStatus: order.pickupStatus,
    total: order.total,
    subtotal: order.subtotal,
    shippingCost: order.shippingCost,
    orderPriority: order.orderPriority,
    designApprovalStatus: order.designApprovalStatus,
    updatedAt: order.updatedAt,
  };
}
