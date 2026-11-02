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
  'Order Date (IST)',
  'Customer Name',
  'Customer Email',
  'Customer Mobile Number',
  'WhatsApp Number',
  'City',
  'State',
  'Pincode',
  'Full Shipping Address',
  'Order Status',
  'Payment Method',
  'Payment Status',
  'Product Names',
  'Product Variants',
  'Product Quantities',
  'Item Subtotal (INR)',
  'Shipping Charges (INR)',
  'Total Order Amount (INR)',
  'Tracking Details',
];

export function parseOrderReportFilters(params) {
  const orderId = paramValue(params, 'orderId', 'orderNumber');
  const mobile = paramValue(params, 'mobile', 'mobileNumber');
  const status = paramValue(params, 'status');
  const dateFrom = paramValue(params, 'dateFrom');
  const dateTo = paramValue(params, 'dateTo');
  const range = parseIstRange(dateFrom, dateTo);
  if (range.error) return { error: range.error };
  const normalizedStatus = status === 'pending' ? 'ordered' : status;
  return {
    orderId,
    mobile,
    status: normalizedStatus,
    dateFrom: range.fromStr,
    dateTo: range.toStr,
    paidAtFrom: range.from,
    paidAtTo: range.to,
    page: boundedPageNumber(paramValue(params, 'page') || 1),
    limit: boundedLimit(paramValue(params, 'limit') || 20, 20, 100),
  };
}

export function buildAdminOrderFilter(filters = {}) {
  const filter = { paymentStatus: 'paid' };
  if (filters.status) {
    filter.status = { $in: ORDER_STATUS_ALIASES[filters.status] || [filters.status] };
  }
  if (filters.orderId) {
    filter.orderNumber = { $regex: escapeRegex(filters.orderId), $options: 'i' };
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
    formatIstDateTime(order.paidAt || order.createdAt),
    address.fullName || '',
    address.email || order.guestEmail || '',
    address.phone || order.phone || '',
    address.whatsappNumber || order.whatsappNumber || '',
    address.city || '',
    address.state || '',
    address.pincode || '',
    fullAddress(address),
    ORDER_STATUS_LABELS[order.status] || order.status || '',
    order.paymentMethod || '',
    order.paymentStatus || '',
    joinItems(items, (item) => item.title || ''),
    joinItems(items, (item) => item.variant || 'No variant'),
    joinItems(items, (item) => String(item.quantity || '')),
    formatInrAmount(order.subtotal),
    formatInrAmount(order.shippingCost),
    formatInrAmount(order.total),
    order.trackingNumber || '',
  ];
}

export function orderCsvLine(order) {
  return `${csvRow(orderCsvValues(order))}\r\n`;
}

export function orderCsvHeaderLine() {
  return `${csvRow(ORDER_CSV_HEADERS)}\r\n`;
}
