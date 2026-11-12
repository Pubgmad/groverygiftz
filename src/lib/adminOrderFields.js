/**
 * Lean Admin order projections. List/status paths must not pull customization
 * photos, design versions, production videos, or other item blobs.
 */

export const ADMIN_ORDER_LIST_SELECT = [
  'orderNumber',
  'orderSource',
  'orderPriority',
  'status',
  'paymentStatus',
  'paymentMethod',
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
  'shippingAddress.fullName',
  'shippingAddress.email',
  'shippingAddress.phone',
  'shippingAddress.whatsappNumber',
  'shippingAddress.city',
  'shippingAddress.state',
  'shippingAddress.pincode',
  'shippingAddress.line1',
].join(' ');

export const ORDER_MUTATION_SELECT = [
  'status',
  'paymentStatus',
  'paymentException',
  'balanceStatus',
  'paymentRecords',
  'orderSource',
  'dispatchDate',
  'parcelRefs',
  'pickupStatus',
  'trackingNumber',
  'trackingUrl',
  'courierCompany',
  'opsStatus',
  'timeline',
  'assignedTo',
  'assignedToName',
].join(' ');

export const DISPATCH_ORDER_SELECT = [
  ORDER_MUTATION_SELECT,
  'orderNumber',
  'shippingAddress',
  'dispatchBatch',
].join(' ');

export const ADMIN_STATS_RECENT_ORDER_SELECT = 'orderNumber status total createdAt paidAt shippingAddress.fullName';

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

export function serializeOrderMutationResult(order) {
  if (!order) return null;
  return {
    _id: order._id,
    status: order.status,
    paymentStatus: order.paymentStatus,
    trackingNumber: order.trackingNumber || '',
    trackingUrl: order.trackingUrl || '',
    courierCompany: order.courierCompany || '',
    opsStatus: order.opsStatus || '',
    dispatchDate: order.dispatchDate || null,
    pickupStatus: order.pickupStatus || '',
    trackingUpdatedAt: order.trackingUpdatedAt || null,
    assignedTo: order.assignedTo || null,
    assignedToName: order.assignedToName || '',
    updatedAt: order.updatedAt || null,
  };
}

export function pickAdminOrderListPatch(order = {}) {
  return {
    status: order.status,
    paymentStatus: order.paymentStatus,
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
    orderPriority: order.orderPriority,
  };
}
