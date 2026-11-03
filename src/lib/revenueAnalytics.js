const IST = 'Asia/Kolkata';
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const STATUS_GROUPS = {
  ordered: ['ordered', 'pending'],
  on_process: ['on_process', 'processing'],
  dispatched: ['dispatched', 'shipped', 'delivered'],
  cancelled: ['cancelled'],
};

export const REVENUE_DEFINITIONS = {
  collectedRevenue: 'Sum of order.total for Cashfree-verified paid orders that are not cancelled. Includes product items and shipping. This matches the Dashboard revenue card rule.',
  productSales: 'Sum of recorded line-item price × quantity. Historical item prices are used, not the current catalog price. Excludes shipping.',
  shippingCollected: 'Sum of shippingCost on qualifying paid orders. This is shipping charged to customers, not carrier cost or shipping profit.',
  paidOrders: 'Count of qualifying paid, non-cancelled orders.',
  refundedAmount: 'Sum of order.total where paymentStatus is refunded. Partial refund amounts are not stored, so a refunded order contributes its full recorded total.',
  eventAt: 'Successful payment time (paidAt), falling back to createdAt when paidAt is missing. All buckets use Asia/Kolkata.',
  district: 'Orders store city, state, and pincode only. District is not recorded and is not inferred.',
  profit: 'Product gross profit is net item revenue minus applicable making cost for items whose cost is known. It is not net business profit: shipping cost, payment fees, packaging, taxes, marketing, and operating expenses are not stored.',
  makingCost: 'Making cost is the admin-entered production cost. Missing cost is unknown, never treated as ₹0. New paid orders snapshot the current cost at checkout. Historical orders only use a cost if a history row applies on or before payment time.',
  uniqueBuyers: 'Unique buyers are identifiable customers with at least one qualifying paid, non-cancelled order in the selected period. One customer with three orders counts as one buyer. Identity uses the customer account id, then guest/shipping email. Phone-only records without email are excluded.',
  repeatBuyers: 'Repeat buyers in period placed at least two qualifying orders inside the selected date range.',
  returningBuyers: 'Returning buyers purchased in the selected period and also had an earlier qualifying purchase before that period.',
  collections: 'Collection performance uses current product membership. Historical collection assignment at purchase time is not stored.',
};

export const DATE_PRESETS = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'last7', label: 'Last 7 days' },
  { id: 'last30', label: 'Last 30 days' },
  { id: 'thisMonth', label: 'This month' },
  { id: 'lastMonth', label: 'Last month' },
  { id: 'thisYear', label: 'This year' },
  { id: 'custom', label: 'Custom' },
];

export function formatIstDateInput(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function shiftIstDate(dateStr, days) {
  const base = new Date(`${dateStr}T12:00:00.000+05:30`);
  base.setUTCDate(base.getUTCDate() + days);
  return formatIstDateInput(base);
}

export function istInclusiveRange(fromStr, toStr) {
  if (!fromStr || !toStr) return null;
  const from = new Date(`${fromStr}T00:00:00.000+05:30`);
  const to = new Date(`${toStr}T23:59:59.999+05:30`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) return null;
  return { from, to, fromStr, toStr };
}

export function previousEquivalentRange(fromStr, toStr) {
  const current = istInclusiveRange(fromStr, toStr);
  if (!current) return null;
  const durationMs = current.to.getTime() - current.from.getTime();
  const prevTo = new Date(current.from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - durationMs);
  return {
    from: prevFrom,
    to: prevTo,
    fromStr: formatIstDateInput(prevFrom),
    toStr: formatIstDateInput(prevTo),
  };
}

export function presetToRange(preset, customFrom, customTo) {
  const today = formatIstDateInput();
  if (preset === 'today') return istInclusiveRange(today, today);
  if (preset === 'yesterday') {
    const day = shiftIstDate(today, -1);
    return istInclusiveRange(day, day);
  }
  if (preset === 'last7') return istInclusiveRange(shiftIstDate(today, -6), today);
  if (preset === 'last30') return istInclusiveRange(shiftIstDate(today, -29), today);
  if (preset === 'thisMonth') return istInclusiveRange(`${today.slice(0, 7)}-01`, today);
  if (preset === 'lastMonth') {
    const thisMonthStart = `${today.slice(0, 7)}-01`;
    const lastDay = shiftIstDate(thisMonthStart, -1);
    const firstDay = `${lastDay.slice(0, 7)}-01`;
    return istInclusiveRange(firstDay, lastDay);
  }
  if (preset === 'thisYear') return istInclusiveRange(`${today.slice(0, 4)}-01-01`, today);
  return istInclusiveRange(customFrom, customTo);
}

export function growthPercent(current, previous) {
  const a = Number(current) || 0;
  const b = Number(previous) || 0;
  if (b === 0) return a === 0 ? 0 : null;
  return Math.round(((a - b) / b) * 1000) / 10;
}

export function normalizeLabel(value, fallback = 'Unknown') {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text || fallback;
}

export function normalizePlaceLabel(value) {
  return String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function uniquePlaceLabels(values = []) {
  const map = new Map();
  values.forEach((value) => {
    const label = normalizePlaceLabel(value);
    if (!label) return;
    const key = label.toLowerCase();
    const current = map.get(key);
    if (!current) {
      map.set(key, label);
      return;
    }
    const score = (text) => {
      const mixed = text !== text.toLowerCase() && text !== text.toUpperCase();
      return mixed ? 2 : text !== text.toLowerCase() ? 1 : 0;
    };
    if (score(label) > score(current)) map.set(key, label);
  });
  return [...map.values()].sort((a, b) => a.localeCompare(b, 'en-IN'));
}

/** Mirror normalizePlaceLabel inside Mongo so dropdown labels and $match agree on NBSP/ZW. */
function mongoNormalizePlaceInput(field) {
  let input = { $toString: { $ifNull: [field, ''] } };
  input = { $replaceAll: { input, find: '\u00a0', replacement: ' ' } };
  ['\u200B', '\u200C', '\u200D', '\uFEFF'].forEach((ch) => {
    input = { $replaceAll: { input, find: ch, replacement: '' } };
  });
  return { $trim: { input } };
}

function placeValue(field) {
  return mongoNormalizePlaceInput(field);
}

function placeKey(field) {
  return { $toLower: placeValue(field) };
}

function statusAlias(status) {
  if (!status) return null;
  return STATUS_GROUPS[status] || [status];
}

export function buyerIdentityExpr() {
  return {
    $cond: [
      { $ifNull: ['$customer', false] },
      { $concat: ['id:', { $toString: '$customer' }] },
      {
        $let: {
          vars: { email: { $toLower: { $trim: { input: { $ifNull: ['$guestEmail', { $ifNull: ['$shippingAddress.email', ''] }] } } } } },
          in: { $cond: [{ $gt: [{ $strLenCP: '$$email' }, 3] }, { $concat: ['email:', '$$email'] }, 'unknown'] },
        },
      },
    ],
  };
}

function escapeRegex(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function variantExactRegex(variant = '') {
  // Order item variants often include trailing spaces; dropdown options are trimmed.
  return `^\\s*${escapeRegex(variant)}\\s*$`;
}

function placeNormalizeStages(state, city) {
  if (!state && !city) return [];
  const stages = [{
    $addFields: {
      _normState: { $toLower: mongoNormalizePlaceInput('$shippingAddress.state') },
      _normCity: { $toLower: mongoNormalizePlaceInput('$shippingAddress.city') },
    },
  }];
  const placeMatch = {};
  if (state) placeMatch._normState = normalizePlaceLabel(state).toLowerCase();
  if (city) placeMatch._normCity = normalizePlaceLabel(city).toLowerCase();
  stages.push({ $match: placeMatch });
  return stages;
}

/**
 * When product/collection/variant filters are active, shrink each order's items[] to
 * matching lines only and rebuild subtotal/total from those lines. Otherwise KPI
 * "collected" / "product sales" would still count sibling products on the same order.
 */
export function narrowToMatchingItems({ productId, productIds, variant } = {}) {
  const hasProduct = Boolean(productId) || (Array.isArray(productIds) && productIds.length > 0);
  const hasVariant = Boolean(variant);
  if (!hasProduct && !hasVariant) return [];

  const conds = [];
  if (productId) conds.push({ $eq: ['$$item.product', productId] });
  else if (Array.isArray(productIds) && productIds.length) conds.push({ $in: ['$$item.product', productIds] });
  if (variant) {
    conds.push({
      $regexMatch: {
        input: { $toString: { $ifNull: ['$$item.variant', ''] } },
        regex: variantExactRegex(variant),
        options: 'i',
      },
    });
  }

  const itemRevenue = {
    $reduce: {
      input: '$items',
      initialValue: 0,
      in: { $add: ['$$value', { $multiply: [{ $ifNull: ['$$this.price', 0] }, { $ifNull: ['$$this.quantity', 0] }] }] },
    },
  };

  return [
    {
      $addFields: {
        items: {
          $filter: {
            input: { $ifNull: ['$items', []] },
            as: 'item',
            cond: conds.length === 1 ? conds[0] : { $and: conds },
          },
        },
      },
    },
    { $match: { 'items.0': { $exists: true } } },
    {
      $addFields: {
        subtotal: itemRevenue,
        // Product/variant-scoped view: do not keep full checkout total (other lines + shipping).
        total: itemRevenue,
        shippingCost: 0,
      },
    },
  ];
}

export function buildRevenueMatch({ from, to, paymentMethod, status, state, city, productId, productIds, variant }) {
  const match = {
    paymentStatus: 'paid',
    status: { $nin: ['cancelled'] },
  };
  if (paymentMethod) {
    // Charts coalesce missing method to Cashfree and fold case via uniquePlaceLabels;
    // the filter must use the same semantics or those rows disappear when Cashfree is selected.
    const target = normalizePlaceLabel(paymentMethod).toLowerCase();
    match.$expr = {
      $eq: [
        { $toLower: { $trim: { input: { $ifNull: ['$paymentMethod', 'Cashfree'] } } } },
        target,
      ],
    };
  }
  const aliases = statusAlias(status);
  if (aliases) match.status = { $in: aliases.filter((value) => value !== 'cancelled') };
  // Order-level product/variant match keeps orders that contain a matching line.
  // narrowToMatchingItems then drops non-matching sibling lines before KPI aggregation.
  if (productId) match['items.product'] = productId;
  else if (Array.isArray(productIds) && productIds.length) match['items.product'] = { $in: productIds };
  if (variant) match['items.variant'] = { $regex: variantExactRegex(variant), $options: 'i' };
  return [
    { $match: match },
    ...placeNormalizeStages(state, city),
    { $addFields: { eventAt: { $ifNull: ['$paidAt', '$createdAt'] } } },
    { $match: { eventAt: { $gte: from, $lte: to } } },
    ...narrowToMatchingItems({ productId, productIds, variant }),
  ];
}

/** After $unwind:$items, keep only line items that match product/variant filters. */
export function itemMatchAfterUnwind({ productId, productIds, variant } = {}) {
  const match = {};
  if (productId) match['items.product'] = productId;
  else if (Array.isArray(productIds) && productIds.length) match['items.product'] = { $in: productIds };
  if (variant) match['items.variant'] = { $regex: variantExactRegex(variant), $options: 'i' };
  return Object.keys(match).length ? [{ $match: match }] : [];
}

function bucketExpr(granularity) {
  const unit = ['day', 'week', 'month', 'year'].includes(granularity) ? granularity : 'day';
  // startOfWeek MUST live inside $dateTrunc. Putting it as a sibling field makes MongoDB reject
  // the expression ("must have exactly one field") and breaks every Weekly trend request.
  const trunc = { date: '$eventAt', unit, timezone: IST };
  if (unit === 'week') trunc.startOfWeek = 'monday';
  return { $dateTrunc: trunc };
}

const orderMetrics = {
  collected: { $sum: { $ifNull: ['$total', 0] } },
  productSales: {
    $sum: {
      $ifNull: [
        '$subtotal',
        {
          $reduce: {
            input: { $ifNull: ['$items', []] },
            initialValue: 0,
            in: { $add: ['$$value', { $multiply: [{ $ifNull: ['$$this.price', 0] }, { $ifNull: ['$$this.quantity', 0] }] }] },
          },
        },
      ],
    },
  },
  shipping: { $sum: { $ifNull: ['$shippingCost', 0] } },
  orders: { $sum: 1 },
  units: {
    $sum: {
      $reduce: {
        input: { $ifNull: ['$items', []] },
        initialValue: 0,
        in: { $add: ['$$value', { $ifNull: ['$$this.quantity', 0] }] },
      },
    },
  },
};

export function revenuePipeline({ from, to, paymentMethod, status, state, city, productId, productIds, variant, granularity = 'day' }) {
  const prefix = buildRevenueMatch({ from, to, paymentMethod, status, state, city, productId, productIds, variant });
  const itemFilter = itemMatchAfterUnwind({ productId, productIds, variant });
  return [
    ...prefix,
    {
      $facet: {
        kpis: [{ $group: { _id: null, ...orderMetrics } }],
        trend: [
          { $group: { _id: bucketExpr(granularity), ...orderMetrics } },
          { $sort: { _id: 1 } },
        ],
        states: [
          {
            $group: {
              _id: { $toLower: { $trim: { input: { $ifNull: ['$shippingAddress.state', ''] } } } },
              label: { $first: { $trim: { input: { $ifNull: ['$shippingAddress.state', 'Unknown'] } } } },
              ...orderMetrics,
            },
          },
          { $sort: { collected: -1 } },
          { $limit: 50 },
        ],
        cities: [
          {
            $group: {
              _id: {
                city: { $toLower: { $trim: { input: { $ifNull: ['$shippingAddress.city', ''] } } } },
                state: { $toLower: { $trim: { input: { $ifNull: ['$shippingAddress.state', ''] } } } },
              },
              city: { $first: { $trim: { input: { $ifNull: ['$shippingAddress.city', 'Unknown'] } } } },
              state: { $first: { $trim: { input: { $ifNull: ['$shippingAddress.state', ''] } } } },
              ...orderMetrics,
            },
          },
          { $sort: { collected: -1 } },
          { $limit: 50 },
        ],
        hours: [
          { $group: { _id: { $hour: { date: '$eventAt', timezone: IST } }, ...orderMetrics } },
          { $sort: { _id: 1 } },
        ],
        weekdays: [
          { $group: { _id: { $dayOfWeek: { date: '$eventAt', timezone: IST } }, ...orderMetrics } },
          { $sort: { _id: 1 } },
        ],
        heatmap: [
          {
            $group: {
              _id: {
                weekday: { $dayOfWeek: { date: '$eventAt', timezone: IST } },
                hour: { $hour: { date: '$eventAt', timezone: IST } },
              },
              orders: { $sum: 1 },
              collected: { $sum: { $ifNull: ['$total', 0] } },
            },
          },
        ],
        payments: [
          {
            $group: {
              _id: { $ifNull: ['$paymentMethod', 'Cashfree'] },
              ...orderMetrics,
            },
          },
          { $sort: { collected: -1 } },
        ],
        statuses: [
          { $group: { _id: { $ifNull: ['$status', 'ordered'] }, orders: { $sum: 1 }, collected: { $sum: { $ifNull: ['$total', 0] } } } },
          { $sort: { orders: -1 } },
        ],
        products: [
          { $unwind: '$items' },
          ...itemFilter,
          {
            $group: {
              _id: { $ifNull: ['$items.product', '$items.title'] },
              title: { $first: { $ifNull: ['$items.title', 'Deleted product'] } },
              image: { $first: { $ifNull: ['$items.image', ''] } },
              productId: { $first: '$items.product' },
              units: { $sum: { $ifNull: ['$items.quantity', 0] } },
              revenue: { $sum: { $multiply: [{ $ifNull: ['$items.price', 0] }, { $ifNull: ['$items.quantity', 0] }] } },
              orders: { $addToSet: '$_id' },
            },
          },
          { $addFields: { orders: { $size: '$orders' } } },
          { $sort: { revenue: -1 } },
          { $limit: 50 },
        ],
        variants: [
          { $unwind: '$items' },
          ...itemFilter,
          { $match: { 'items.variant': { $nin: [null, ''] } } },
          {
            $group: {
              _id: { title: { $ifNull: ['$items.title', 'Product'] }, variant: '$items.variant' },
              units: { $sum: { $ifNull: ['$items.quantity', 0] } },
              revenue: { $sum: { $multiply: [{ $ifNull: ['$items.price', 0] }, { $ifNull: ['$items.quantity', 0] }] } },
            },
          },
          { $sort: { units: -1 } },
          { $limit: 30 },
        ],
        customers: [
          {
            $group: {
              _id: buyerIdentityExpr(),
              orders: { $sum: 1 },
              collected: { $sum: { $ifNull: ['$total', 0] } },
            },
          },
        ],
      },
    },
  ];
}

export function kpiPipeline(filters = {}) {
  return [
    ...buildRevenueMatch(filters),
    { $group: { _id: null, ...orderMetrics } },
  ];
}

export function refundPipeline({ from, to, paymentMethod, status, state, city, productId, productIds, variant } = {}) {
  const match = { paymentStatus: 'refunded' };
  if (paymentMethod) {
    const target = normalizePlaceLabel(paymentMethod).toLowerCase();
    match.$expr = {
      $eq: [
        { $toLower: { $trim: { input: { $ifNull: ['$paymentMethod', 'Cashfree'] } } } },
        target,
      ],
    };
  }
  const aliases = statusAlias(status);
  if (aliases) match.status = { $in: aliases };
  if (productId) match['items.product'] = productId;
  else if (Array.isArray(productIds) && productIds.length) match['items.product'] = { $in: productIds };
  if (variant) match['items.variant'] = { $regex: variantExactRegex(variant), $options: 'i' };
  return [
    { $match: match },
    ...placeNormalizeStages(state, city),
    { $addFields: { eventAt: { $ifNull: ['$paidAt', '$createdAt'] } } },
    { $match: { eventAt: { $gte: from, $lte: to } } },
    ...narrowToMatchingItems({ productId, productIds, variant }),
    { $group: { _id: null, amount: { $sum: { $ifNull: ['$total', 0] } }, orders: { $sum: 1 } } },
  ];
}

export function paymentOutcomePipeline({ from, to, paymentMethod, status, state, city, productId, productIds, variant } = {}) {
  const match = {};
  if (paymentMethod) {
    const target = normalizePlaceLabel(paymentMethod).toLowerCase();
    match.$expr = {
      $eq: [
        { $toLower: { $trim: { input: { $ifNull: ['$paymentMethod', 'Cashfree'] } } } },
        target,
      ],
    };
  }
  const aliases = statusAlias(status);
  if (aliases) match.status = { $in: aliases };
  else match.status = { $nin: ['cancelled'] };
  if (productId) match['items.product'] = productId;
  else if (Array.isArray(productIds) && productIds.length) match['items.product'] = { $in: productIds };
  if (variant) match['items.variant'] = { $regex: variantExactRegex(variant), $options: 'i' };
  return [
    ...(Object.keys(match).length ? [{ $match: match }] : []),
    ...placeNormalizeStages(state, city),
    { $addFields: { eventAt: { $ifNull: ['$paidAt', '$createdAt'] } } },
    { $match: { eventAt: { $gte: from, $lte: to } } },
    ...narrowToMatchingItems({ productId, productIds, variant }),
    { $group: { _id: { $ifNull: ['$paymentStatus', 'pending'] }, orders: { $sum: 1 }, amount: { $sum: { $ifNull: ['$total', 0] } } } },
  ];
}

export function filterOptionPipeline({ from, to, state, productId, productIds } = {}) {
  // Scope dropdown choices to the same product/collection slice as the main query so
  // choosing a variant cannot silently target a different product than the Product filter.
  return [
    ...buildRevenueMatch({ from, to, state, productId, productIds }),
    {
      $facet: {
        states: [
          { $group: { _id: placeKey('$shippingAddress.state'), label: { $first: placeValue('$shippingAddress.state') } } },
          { $match: { _id: { $nin: ['', null] } } },
          { $sort: { label: 1 } },
        ],
        cities: [
          { $group: { _id: placeKey('$shippingAddress.city'), label: { $first: placeValue('$shippingAddress.city') } } },
          { $match: { _id: { $nin: ['', null] } } },
          { $sort: { label: 1 } },
        ],
        methods: [
          { $group: { _id: { $ifNull: ['$paymentMethod', 'Cashfree'] } } },
          { $sort: { _id: 1 } },
        ],
        products: [
          { $unwind: { path: '$items', preserveNullAndEmptyArrays: false } },
          {
            $group: {
              _id: { $toString: { $ifNull: ['$items.product', ''] } },
              title: { $first: { $ifNull: ['$items.title', 'Product'] } },
            },
          },
          { $match: { _id: { $nin: ['', null] } } },
          { $sort: { title: 1 } },
          { $limit: 300 },
        ],
        variants: [
          { $unwind: { path: '$items', preserveNullAndEmptyArrays: false } },
          { $match: { 'items.variant': { $nin: ['', null] } } },
          {
            $group: {
              _id: { $trim: { input: { $toString: { $ifNull: ['$items.variant', ''] } } } },
            },
          },
          { $match: { _id: { $nin: ['', null] } } },
          { $sort: { _id: 1 } },
          { $limit: 200 },
        ],
      },
    },
  ];
}

export function profitItemPipeline(filters) {
  return [
    ...buildRevenueMatch(filters),
    { $unwind: '$items' },
    ...itemMatchAfterUnwind(filters),
    {
      $project: {
        orderId: '$_id',
        eventAt: 1,
        product: '$items.product',
        title: '$items.title',
        image: '$items.image',
        variant: '$items.variant',
        quantity: '$items.quantity',
        price: '$items.price',
        snapshotCost: '$items.makingCost',
        snapshotStatus: '$items.makingCostStatus',
        snapshotSource: '$items.makingCostSource',
        state: '$shippingAddress.state',
        city: '$shippingAddress.city',
      },
    },
  ];
}

export function buyerListPipeline(filters) {
  return [
    ...buildRevenueMatch(filters),
    {
      $group: {
        _id: buyerIdentityExpr(),
        customerId: { $first: '$customer' },
        email: { $first: { $toLower: { $trim: { input: { $ifNull: ['$guestEmail', { $ifNull: ['$shippingAddress.email', ''] }] } } } } },
        name: { $first: { $ifNull: ['$shippingAddress.fullName', ''] } },
        phone: { $first: { $ifNull: ['$shippingAddress.phone', { $ifNull: ['$shippingAddress.whatsappNumber', ''] }] } },
        orders: { $sum: 1 },
        collected: { $sum: { $ifNull: ['$total', 0] } },
        firstAt: { $min: '$eventAt' },
        lastAt: { $max: '$eventAt' },
        orderIds: { $addToSet: '$_id' },
        itemTitles: { $push: { $ifNull: ['$items.title', []] } },
      },
    },
    { $match: { _id: { $ne: 'unknown' } } },
  ];
}

export function shapeFilterOptions(options = {}, collections = []) {
  return {
    states: uniquePlaceLabels((options.states || []).map((row) => row.label || row._id)),
    cities: uniquePlaceLabels((options.cities || []).map((row) => row.label || row._id)),
    methods: uniquePlaceLabels((options.methods || []).map((row) => row._id || 'Cashfree')),
    products: (options.products || [])
      .filter((row) => row._id)
      .map((row) => ({
        id: String(row._id),
        title: normalizePlaceLabel(row.title) || 'Product',
      }))
      .sort((a, b) => a.title.localeCompare(b.title, 'en-IN')),
    collections: collections.map((row) => ({ id: String(row._id), name: row.name })),
    variants: uniquePlaceLabels((options.variants || []).map((row) => row._id)),
  };
}

export function shapeKpis(row = {}, previous = {}, refund = {}, profit = {}, previousProfit = {}) {
  const collected = Number(row.collected || 0);
  const previousCollected = Number(previous.collected || 0);
  const orders = Number(row.orders || 0);
  const productGrossProfit = Number(profit.productGrossProfit || 0);
  const previousGrossProfit = Number(previousProfit.productGrossProfit || 0);
  const knownCostRevenue = Number(profit.knownCostRevenue || 0);
  return {
    collectedRevenue: collected,
    productSales: Number(row.productSales || 0),
    shippingCollected: Number(row.shipping || 0),
    paidOrders: orders,
    averageOrderValue: orders ? collected / orders : 0,
    unitsSold: Number(row.units || 0),
    refundedAmount: Number(refund.amount || 0),
    refundedOrders: Number(refund.orders || 0),
    previousCollectedRevenue: previousCollected,
    revenueGrowthPct: growthPercent(collected, previousCollected),
    previousPaidOrders: Number(previous.orders || 0),
    orderGrowthPct: growthPercent(orders, previous.orders || 0),
    makingCostKnown: Number(profit.makingCostKnown || 0),
    knownCostRevenue,
    unknownCostRevenue: Number(profit.unknownCostRevenue || 0),
    unknownCostUnits: Number(profit.unknownCostUnits || 0),
    productGrossProfit,
    previousProductGrossProfit: previousGrossProfit,
    grossMarginPct: profit.grossMarginPct === undefined ? (knownCostRevenue ? Math.round((productGrossProfit / knownCostRevenue) * 1000) / 10 : null) : profit.grossMarginPct,
    costCoveragePct: profit.costCoveragePct === undefined ? 0 : profit.costCoveragePct,
    profitComplete: profit.complete === true,
    averageGrossProfitPerOrder: orders ? productGrossProfit / orders : 0,
    profitGrowthPct: growthPercent(productGrossProfit, previousGrossProfit),
    mostProfitableProduct: profit.mostProfitableProduct || null,
    leastProfitableProduct: profit.leastProfitableProduct || null,
    peakProfitDay: profit.peakProfitDay || null,
    peakProfitProduct: profit.peakProfitProduct || null,
  };
}

export function shapeTrend(rows = [], granularity = 'day') {
  return rows.map((row) => ({
    bucket: row._id ? new Date(row._id).toISOString() : null,
    // Must match istBucketLabel used by profit trend rows or monthly/yearly profit merges as ₹0.
    label: row._id ? istBucketLabel(row._id, granularity) : '',
    collected: Number(row.collected || 0),
    orders: Number(row.orders || 0),
    units: Number(row.units || 0),
    productSales: Number(row.productSales || 0),
    makingCost: Number(row.makingCost || 0),
    grossProfit: Number(row.grossProfit || 0),
    unknownCostRevenue: Number(row.unknownCostRevenue || 0),
  }));
}

/** Keep order-facet collected/orders; overlay profit fields by place key. */
export function mergeProfitIntoPlaces(orderRows = [], profitRows = [], type = 'state') {
  const byKey = Object.fromEntries((profitRows || []).map((row) => {
    const key = type === 'city'
      ? `${String(row.label || row.city || 'Unknown').toLowerCase()}|${String(row.state || '').toLowerCase()}`
      : String(row.label || row.key || 'Unknown').toLowerCase();
    return [key, row];
  }));
  return (orderRows || []).map((row) => {
    const key = type === 'city'
      ? `${String(row.city || 'Unknown').toLowerCase()}|${String(row.state || '').toLowerCase()}`
      : String(row.label || row._id || 'Unknown').toLowerCase();
    const profit = byKey[key];
    return {
      ...row,
      makingCost: profit ? Number(profit.makingCost || 0) : Number(row.makingCost || 0),
      grossProfit: profit ? Number(profit.grossProfit || 0) : Number(row.grossProfit || 0),
      unknownRevenue: profit ? Number(profit.unknownRevenue || 0) : Number(row.unknownRevenue || 0),
    };
  });
}

function withShare(rows, valueKey) {
  const total = rows.reduce((sum, row) => sum + Number(row[valueKey] || 0), 0);
  return rows.map((row) => ({
    ...row,
    sharePct: total ? Math.round((Number(row[valueKey] || 0) / total) * 1000) / 10 : 0,
  }));
}

export function shapePlaces(rows = [], type) {
  return withShare(rows.map((row) => ({
    key: type === 'city' ? `${row.city || 'Unknown'}|${row.state || ''}` : (row.label || row._id || 'Unknown'),
    label: type === 'city' ? (row.city || 'Unknown') : (row.label || row._id || 'Unknown'),
    state: row.state || '',
    collected: Number(row.collected || 0),
    orders: Number(row.orders || 0),
    units: Number(row.units || 0),
    averageOrderValue: row.orders ? Number(row.collected || 0) / Number(row.orders) : 0,
    makingCost: Number(row.makingCost || 0),
    grossProfit: Number(row.grossProfit || 0),
    unknownRevenue: Number(row.unknownRevenue || 0),
  })), 'collected');
}

export function shapeHours(rows = []) {
  const byHour = new Map(rows.map((row) => [Number(row._id), row]));
  return Array.from({ length: 24 }, (_, hour) => {
    const row = byHour.get(hour) || {};
    return {
      hour,
      label: `${String(hour).padStart(2, '0')}:00`,
      orders: Number(row.orders || 0),
      collected: Number(row.collected || 0),
      averageOrderValue: row.orders ? Number(row.collected || 0) / Number(row.orders) : 0,
    };
  });
}

export function shapeWeekdays(rows = []) {
  const byDay = new Map(rows.map((row) => [Number(row._id), row]));
  return WEEKDAYS.map((label, index) => {
    const mongoDay = index + 1;
    const row = byDay.get(mongoDay) || {};
    return {
      weekday: label,
      orders: Number(row.orders || 0),
      collected: Number(row.collected || 0),
    };
  });
}

export function shapeHeatmap(rows = []) {
  const map = new Map(rows.map((row) => [`${row._id?.weekday}-${row._id?.hour}`, row]));
  return WEEKDAYS.map((label, index) => ({
    weekday: label,
    hours: Array.from({ length: 24 }, (_, hour) => {
      const row = map.get(`${index + 1}-${hour}`) || {};
      return { hour, orders: Number(row.orders || 0), collected: Number(row.collected || 0) };
    }),
  }));
}

export function shapeProducts(rows = []) {
  return withShare(rows.map((row) => {
    const revenue = Number(row.revenue || 0);
    const knownRevenue = Number(row.knownRevenue || 0);
    const unknownRevenue = Number(row.unknownRevenue || 0);
    const costCoveragePct = row.costCoveragePct === undefined || row.costCoveragePct === null
      ? (revenue ? Math.round((knownRevenue / revenue) * 1000) / 10 : 100)
      : Number(row.costCoveragePct);
    const knownCostUnits = Number(row.knownCostUnits || 0);
    const profitKnown = knownCostUnits > 0 || knownRevenue > 0;
    return {
      id: row.productId ? String(row.productId) : '',
      title: row.title || 'Deleted product',
      image: row.image || '',
      units: Number(row.units || 0),
      revenue,
      orders: Number(row.orders || 0),
      averagePrice: row.units ? revenue / Number(row.units) : 0,
      // Missing cost must stay null — never coerce unknown to ₹0 profit.
      makingCost: profitKnown ? Number(row.makingCost || 0) : null,
      grossProfit: profitKnown ? Number(row.grossProfit || 0) : null,
      marginPct: profitKnown && row.marginPct !== undefined && row.marginPct !== null ? Number(row.marginPct) : null,
      unknownRevenue,
      knownRevenue,
      knownCostUnits,
      costCoveragePct,
      profitKnown,
    };
  }), 'revenue');
}

export function shapeInsights({ kpis, trend, states, hours, weekdays, products }) {
  if (!kpis.paidOrders) return ['No paid, non-cancelled orders in this period.'];
  const topDay = [...trend].sort((a, b) => b.collected - a.collected)[0];
  const peakHour = [...hours].sort((a, b) => b.orders - a.orders || b.collected - a.collected)[0];
  const lowHour = [...hours].sort((a, b) => a.orders - b.orders || a.collected - b.collected)[0];
  const topWeekday = [...weekdays].sort((a, b) => b.orders - a.orders)[0];
  const topState = states[0];
  const topProduct = [...(products || [])].sort((a, b) => Number(b.revenue || 0) - Number(a.revenue || 0))[0];
  const notes = [];
  if (topDay?.collected) notes.push(`Highest collected revenue day: ${topDay.label} (${Math.round(topDay.collected)}).`);
  if (peakHour) notes.push(`Busiest payment hour (IST): ${peakHour.label} with ${peakHour.orders} paid orders.`);
  if (lowHour) notes.push(`Quietest payment hour (IST): ${lowHour.label}.`);
  if (topWeekday) notes.push(`Busiest weekday: ${topWeekday.weekday}.`);
  if (topState?.label) notes.push(`Highest-revenue state: ${topState.label}.`);
  if (topProduct?.title) notes.push(`Highest-revenue product: ${topProduct.title}.`);
  if (kpis.mostProfitableProduct?.title) notes.push(`Highest product gross profit: ${kpis.mostProfitableProduct.title}.`);
  if (kpis.leastProfitableProduct?.title && kpis.leastProfitableProduct.title !== kpis.mostProfitableProduct?.title) {
    notes.push(`Lowest product gross profit among known-cost items: ${kpis.leastProfitableProduct.title}.`);
  }
  if (kpis.profitComplete === false) notes.push(`Making-cost coverage is ${kpis.costCoveragePct || 0}% of product revenue. Unknown-cost items are excluded from product gross profit.`);
  if (kpis.revenueGrowthPct === null) notes.push('Revenue growth is omitted because the previous period had zero collected revenue.');
  else notes.push(`Collected revenue changed ${kpis.revenueGrowthPct}% versus the previous equivalent period.`);
  return notes;
}

export function mergeProfitIntoTrend(trend = [], profitRows = []) {
  const byLabel = Object.fromEntries(profitRows.map((row) => [row.label, row]));
  return trend.map((row) => ({
    ...row,
    makingCost: Number(byLabel[row.label]?.makingCost || 0),
    grossProfit: Number(byLabel[row.label]?.grossProfit || 0),
    unknownCostRevenue: Number(byLabel[row.label]?.unknownRevenue || 0),
  }));
}

export function istBucketLabel(date, granularity = 'day') {
  const day = formatIstDateInput(date);
  if (granularity === 'year') return day.slice(0, 4);
  if (granularity === 'month') return day.slice(0, 7);
  if (granularity === 'week') {
    const current = new Date(`${day}T12:00:00.000+05:30`);
    const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: IST }).format(current);
    const offset = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }[weekday] || 0;
    current.setUTCDate(current.getUTCDate() - offset);
    return formatIstDateInput(current);
  }
  return day;
}

export { IST, WEEKDAYS, STATUS_GROUPS };
