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

export const CUSTOMER_TYPES = {
  all: '',
  purchased: 'purchased',
  not_purchased: 'not_purchased',
};

export const CUSTOMER_TYPE_LABELS = {
  purchased: 'Purchased',
  not_purchased: 'Not yet purchased',
};

export const CUSTOMER_CSV_HEADERS = [
  'Customer ID',
  'Customer Name',
  'Email',
  'Mobile Number',
  'Account Registration Date (IST)',
  'Total Orders',
  'Qualifying Purchased Orders',
  'Total Amount Spent (INR)',
  'First Purchase Date (IST)',
  'Last Purchase Date (IST)',
  'Customer Type',
];

const SECRET_CUSTOMER_FIELDS = {
  password: 0,
  googleId: 0,
  resetPasswordToken: 0,
  resetPasswordExpires: 0,
  cart: 0,
  wishlist: 0,
  orders: 0,
  qualifying: 0,
};

export function parseCustomerReportFilters(params) {
  const name = paramValue(params, 'name');
  const email = paramValue(params, 'email');
  const mobile = paramValue(params, 'mobile', 'phone', 'mobileNumber');
  const typeRaw = paramValue(params, 'customerType', 'type');
  const customerType = typeRaw === 'purchased' || typeRaw === 'not_purchased' ? typeRaw : '';
  if (typeRaw && typeRaw !== 'all' && !customerType) return { error: 'Unknown customer type filter' };
  const registered = parseIstRange(paramValue(params, 'dateFrom', 'registeredFrom'), paramValue(params, 'dateTo', 'registeredTo'));
  if (registered.error) return { error: registered.error };
  const lastPurchase = parseIstRange(paramValue(params, 'lastFrom', 'lastPurchaseFrom'), paramValue(params, 'lastTo', 'lastPurchaseTo'));
  if (lastPurchase.error) return { error: lastPurchase.error };
  return {
    name,
    email,
    mobile,
    customerType,
    dateFrom: registered.fromStr,
    dateTo: registered.toStr,
    registeredFrom: registered.from,
    registeredTo: registered.to,
    lastFrom: lastPurchase.fromStr,
    lastTo: lastPurchase.toStr,
    lastPurchaseFrom: lastPurchase.from,
    lastPurchaseTo: lastPurchase.to,
    page: boundedPageNumber(paramValue(params, 'page') || 1),
    limit: boundedLimit(paramValue(params, 'limit') || 10, 10, 100),
  };
}

export function buildCustomerAccountMatch(filters = {}) {
  const match = {};
  if (filters.name) match.name = { $regex: escapeRegex(filters.name), $options: 'i' };
  if (filters.email) match.email = { $regex: escapeRegex(filters.email), $options: 'i' };
  if (filters.registeredFrom || filters.registeredTo) {
    match.createdAt = {};
    if (filters.registeredFrom) match.createdAt.$gte = filters.registeredFrom;
    if (filters.registeredTo) match.createdAt.$lte = filters.registeredTo;
  }
  if (filters.mobile) {
    const mobileTerm = filters.mobile.replace(/\D/g, '') || filters.mobile;
    const mobileRegex = { $regex: escapeRegex(mobileTerm), $options: 'i' };
    match.$or = [
      { phone: mobileRegex },
      { 'addresses.phone': mobileRegex },
    ];
  }
  return match;
}

function emailVarExpr() {
  return { $toLower: { $trim: { input: { $ifNull: ['$email', ''] } } } };
}

function orderEmailExpr(field) {
  return { $toLower: { $trim: { input: { $ifNull: [field, ''] } } } };
}

export function customerOrderLinkExpr() {
  return {
    $or: [
      { $eq: ['$customer', '$$cid'] },
      {
        $and: [
          { $eq: [{ $ifNull: ['$customer', null] }, null] },
          { $gt: [{ $strLenCP: '$$email' }, 3] },
          {
            $or: [
              { $eq: [orderEmailExpr('$guestEmail'), '$$email'] },
              { $eq: [orderEmailExpr('$shippingAddress.email'), '$$email'] },
            ],
          },
        ],
      },
    ],
  };
}

function orderLookupStage() {
  return {
    $lookup: {
      from: 'orders',
      let: { cid: '$_id', email: emailVarExpr() },
      pipeline: [
        { $match: { $expr: customerOrderLinkExpr() } },
        {
          $project: {
            total: 1,
            paidAt: 1,
            createdAt: 1,
            paymentStatus: 1,
            status: 1,
          },
        },
      ],
      as: 'orders',
    },
  };
}

function purchaseFieldsStage() {
  return {
    $addFields: {
      qualifying: {
        $filter: {
          input: { $ifNull: ['$orders', []] },
          as: 'o',
          cond: {
            $and: [
              { $eq: ['$$o.paymentStatus', 'paid'] },
              { $ne: ['$$o.status', 'cancelled'] },
            ],
          },
        },
      },
      totalOrders: { $size: { $ifNull: ['$orders', []] } },
    },
  };
}

function purchaseSummaryStage() {
  const eventAt = { $ifNull: ['$$o.paidAt', '$$o.createdAt'] };
  return {
    $addFields: {
      qualifyingOrders: { $size: { $ifNull: ['$qualifying', []] } },
      totalSpent: { $sum: { $ifNull: ['$qualifying.total', []] } },
      firstPurchaseAt: {
        $min: {
          $map: { input: { $ifNull: ['$qualifying', []] }, as: 'o', in: eventAt },
        },
      },
      lastPurchaseAt: {
        $max: {
          $map: { input: { $ifNull: ['$qualifying', []] }, as: 'o', in: eventAt },
        },
      },
      customerType: {
        $cond: [
          { $gt: [{ $size: { $ifNull: ['$qualifying', []] } }, 0] },
          'purchased',
          'not_purchased',
        ],
      },
    },
  };
}

export function buildPurchaseMetricMatch(filters = {}) {
  const match = {};
  if (filters.customerType) match.customerType = filters.customerType;
  if (filters.lastPurchaseFrom || filters.lastPurchaseTo) {
    match.lastPurchaseAt = {};
    if (filters.lastPurchaseFrom) match.lastPurchaseAt.$gte = filters.lastPurchaseFrom;
    if (filters.lastPurchaseTo) match.lastPurchaseAt.$lte = filters.lastPurchaseTo;
  }
  return match;
}

export function customerReportStages(filters = {}) {
  const stages = [
    { $match: buildCustomerAccountMatch(filters) },
    orderLookupStage(),
    purchaseFieldsStage(),
    purchaseSummaryStage(),
  ];
  const metricMatch = buildPurchaseMetricMatch(filters);
  if (Object.keys(metricMatch).length) stages.push({ $match: metricMatch });
  stages.push({ $sort: { createdAt: -1 } });
  return stages;
}

export function customerReportPipeline(filters = {}, { skip, limit } = {}) {
  const stages = customerReportStages(filters);
  if (Number.isInteger(skip) && Number.isInteger(limit)) {
    return [
      ...stages,
      {
        $facet: {
          meta: [{ $count: 'total' }],
          rows: [
            { $skip: skip },
            { $limit: limit },
            { $project: SECRET_CUSTOMER_FIELDS },
          ],
        },
      },
    ];
  }
  return [...stages, { $project: SECRET_CUSTOMER_FIELDS }];
}

export function shapeCustomerRow(row = {}) {
  return {
    _id: row._id,
    name: row.name || '',
    email: row.email || '',
    phone: row.phone || '',
    createdAt: row.createdAt || null,
    totalOrders: Number(row.totalOrders || 0),
    qualifyingOrders: Number(row.qualifyingOrders || 0),
    totalSpent: Number(row.totalSpent || 0),
    firstPurchaseAt: row.firstPurchaseAt || null,
    lastPurchaseAt: row.lastPurchaseAt || null,
    customerType: row.customerType === 'purchased' ? 'purchased' : 'not_purchased',
  };
}

export function customerCsvFilename(filters) {
  return csvFilename(
    'customers',
    filters?.dateFrom || filters?.lastFrom,
    filters?.dateTo || filters?.lastTo,
    formatIstDateInput(),
  );
}

export function customerCsvValues(row = {}) {
  const shaped = shapeCustomerRow(row);
  return [
    shaped._id ? String(shaped._id) : '',
    shaped.name,
    shaped.email,
    shaped.phone,
    formatIstDateTime(shaped.createdAt),
    String(shaped.totalOrders),
    String(shaped.qualifyingOrders),
    formatInrAmount(shaped.totalSpent),
    formatIstDateTime(shaped.firstPurchaseAt),
    formatIstDateTime(shaped.lastPurchaseAt),
    CUSTOMER_TYPE_LABELS[shaped.customerType] || shaped.customerType,
  ];
}

export function customerCsvLine(row) {
  return `${csvRow(customerCsvValues(row))}\r\n`;
}

export function customerCsvHeaderLine() {
  return `${csvRow(CUSTOMER_CSV_HEADERS)}\r\n`;
}
