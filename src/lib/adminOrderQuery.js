import {
  boundedLimit,
  boundedPageNumber,
  csvFilename,
  escapeRegex,
  formatIstDateInput,
  formatIstDateTime,
  paramValue,
  parseIstRange,
} from '@/lib/adminFilters';
import { csvRow, formatInrAmount } from '@/lib/csvExport';

export const ORDER_STATUS_ALIASES = {
  ordered: ['ordered', 'pending'],
  on_process: ['on_process', 'processing'],
  dispatched: ['dispatched', 'shipped', 'delivered'],
  cancelled: ['cancelled'],
};

export const ORDER_STATUS_LABELS = {
  ordered: 'Ordered',
  on_process: 'On Process',
  dispatched: 'Order Dispatched',
  pending: 'Ordered',
  processing: 'On Process',
  shipped: 'Order Dispatched',
  delivered: 'Order Dispatched',
  cancelled: 'Cancelled',
};

export const ORDER_CSV_HEADERS = [
  'Order ID',
  'Order Source',
  'Order Date (IST)',
  'Customer Name',
  'Customer Email',
  'Customer Mobile Number',
  'WhatsApp Number',
  'City',
  'District',
  'State',
  'Pincode',
  'Full Shipping Address',
  'Order Status',
  'Ops Status',
  'Assigned To',
  'Expected Dispatch',
  'Payment Method',
  'Payment Status',
  'Balance Status',
  'Product Names',
  'Product Variants',
  'Product Quantities',
  'Item Subtotal (INR)',
  'Shipping Charges (INR)',
  'Total Order Amount (INR)',
  'Advance Paid (INR)',
  'Remaining Balance (INR)',
  'Tracking Details',
];

export function parseOrderReportFilters(params) {
  const orderId = paramValue(params, 'orderId', 'orderNumber');
  const name = paramValue(params, 'name');
  const mobile = paramValue(params, 'mobile', 'mobileNumber');
  const status = paramValue(params, 'status');
  const source = paramValue(params, 'source', 'orderSource');
  const opsStatus = paramValue(params, 'opsStatus');
  const assignedTo = paramValue(params, 'assignedTo');
  const dateFrom = paramValue(params, 'dateFrom');
  const dateTo = paramValue(params, 'dateTo');
  const range = parseIstRange(dateFrom, dateTo);
  if (range.error) return { error: range.error };
  const expectedFrom = paramValue(params, 'expectedFrom', 'expectedDispatchFrom');
  const expectedTo = paramValue(params, 'expectedTo', 'expectedDispatchTo');
  const expectedRange = parseIstRange(expectedFrom, expectedTo);
  if (expectedRange.error) return { error: expectedRange.error };
  const urgency = paramValue(params, 'urgency');
  const normalizedStatus = status === 'pending' ? 'ordered' : status;
  return {
    orderId,
    name,
    mobile,
    status: normalizedStatus,
    source: String(source || '').toLowerCase(),
    opsStatus,
    assignedTo,
    dateFrom: range.fromStr,
    dateTo: range.toStr,
    paidAtFrom: range.from,
    paidAtTo: range.to,
    expectedFrom: expectedRange.fromStr,
    expectedTo: expectedRange.toStr,
    expectedDispatchFrom: expectedRange.from,
    expectedDispatchTo: expectedRange.to,
    urgency: String(urgency || '').toLowerCase(),
    page: boundedPageNumber(paramValue(params, 'page') || 1),
    limit: boundedLimit(paramValue(params, 'limit') || 20, 20, 100),
  };
}

export function buildAdminOrderFilter(filters = {}) {
  // Paid website (and any paid) orders + all WhatsApp/Instagram ops orders (including unpaid).
  const filter = {
    $or: [
      { paymentStatus: 'paid' },
      { orderSource: { $in: ['whatsapp', 'instagram'] } },
    ],
  };
  if (filters.source === 'website') {
    filter.$or = [
      { paymentStatus: 'paid', orderSource: 'website' },
      { paymentStatus: 'paid', orderSource: { $exists: false } },
      { paymentStatus: 'paid', orderSource: null },
    ];
  } else if (filters.source === 'whatsapp' || filters.source === 'instagram') {
    delete filter.$or;
    filter.orderSource = filters.source;
  }
  if (filters.status) {
    filter.status = { $in: ORDER_STATUS_ALIASES[filters.status] || [filters.status] };
  }
  if (filters.opsStatus) {
    filter.opsStatus = filters.opsStatus;
  }
  if (filters.assignedTo) {
    filter.assignedTo = filters.assignedTo;
  }
  if (filters.orderId) {
    filter.orderNumber = { $regex: escapeRegex(filters.orderId), $options: 'i' };
  }
  if (filters.name) {
    filter['shippingAddress.fullName'] = { $regex: escapeRegex(filters.name), $options: 'i' };
  }
  if (filters.mobile) {
    const mobileTerm = filters.mobile.replace(/\D/g, '') || filters.mobile;
    const mobileRegex = { $regex: escapeRegex(mobileTerm), $options: 'i' };
    filter.$and = [
      ...(filter.$and || []),
      {
        $or: [
          { 'shippingAddress.phone': mobileRegex },
          { 'shippingAddress.whatsappNumber': mobileRegex },
          { phone: mobileRegex },
          { whatsappNumber: mobileRegex },
        ],
      },
    ];
  }
  if (filters.paidAtFrom || filters.paidAtTo) {
    filter.paidAt = {};
    if (filters.paidAtFrom) filter.paidAt.$gte = filters.paidAtFrom;
    if (filters.paidAtTo) filter.paidAt.$lte = filters.paidAtTo;
  }
  // Expected dispatch date (promised to customer) — not paidAt / actual parcel date
  if (filters.expectedDispatchFrom || filters.expectedDispatchTo) {
    filter.expectedDispatchDate = {};
    if (filters.expectedDispatchFrom) filter.expectedDispatchDate.$gte = filters.expectedDispatchFrom;
    if (filters.expectedDispatchTo) filter.expectedDispatchDate.$lte = filters.expectedDispatchTo;
  }
  // Prefer explicit orderPriority (WhatsApp urgent). Legacy urgency=urgent also matched previewRequired.
  if (filters.urgency === 'urgent') {
    filter.orderPriority = 'urgent';
  } else if (filters.urgency === 'normal') {
    filter.orderPriority = { $ne: 'urgent' };
  }
  return filter;
}

export function orderCsvFilename(filters) {
  return csvFilename('orders', filters?.dateFrom, filters?.dateTo, formatIstDateInput());
}

function joinItems(items, pick) {
  return (items || []).map(pick).join(' | ');
}

function fullAddress(address = {}) {
  return [address.line1, address.line2, address.city, address.state, address.pincode].filter(Boolean).join(', ');
}

export function orderCsvValues(order = {}) {
  const address = order.shippingAddress || {};
  const items = Array.isArray(order.items) ? order.items : [];
  return [
    order.orderNumber || '',
    order.orderSource || 'website',
    formatIstDateTime(order.paidAt || order.createdAt),
    address.fullName || '',
    address.email || order.guestEmail || '',
    address.phone || order.phone || '',
    address.whatsappNumber || order.whatsappNumber || '',
    address.city || '',
    address.district || '',
    address.state || '',
    address.pincode || '',
    fullAddress(address),
    ORDER_STATUS_LABELS[order.status] || order.status || '',
    order.opsStatus || '',
    order.assignedToName || '',
    order.expectedDispatchDate ? formatIstDateTime(order.expectedDispatchDate) : '',
    order.paymentMethod || '',
    order.paymentStatus || '',
    order.balanceStatus || '',
    joinItems(items, (item) => item.title || ''),
    joinItems(items, (item) => item.variant || 'No variant'),
    joinItems(items, (item) => String(item.quantity || '')),
    formatInrAmount(order.subtotal),
    formatInrAmount(order.shippingCost),
    formatInrAmount(order.total),
    formatInrAmount(order.advancePaid),
    formatInrAmount(order.remainingBalance),
    order.trackingNumber || '',
  ];
}

export function orderCsvLine(order) {
  return `${csvRow(orderCsvValues(order))}\r\n`;
}

export function orderCsvHeaderLine() {
  return `${csvRow(ORDER_CSV_HEADERS)}\r\n`;
}
