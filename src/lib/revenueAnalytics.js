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
  profit: 'Product cost is not stored, so profit is not calculated.',
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

function placeValue(field) {
  return {
    $trim: {
      input: { $toString: { $ifNull: [field, ''] } },
    },
  };
}

function placeKey(field) {
  return { $toLower: placeValue(field) };
}

function statusAlias(status) {
  if (!status) return null;
  return STATUS_GROUPS[status] || [status];
}

export function buildRevenueMatch({ from, to, paymentMethod, status, state, city, productId }) {
  const match = {
    paymentStatus: 'paid',
    status: { $nin: ['cancelled'] },
  };
  if (paymentMethod) match.paymentMethod = paymentMethod;
  const aliases = statusAlias(status);
  if (aliases) match.status = { $in: aliases.filter((value) => value !== 'cancelled') };
  if (state) match['shippingAddress.state'] = { $regex: `^${escapeRegex(state)}$`, $options: 'i' };
  if (city) match['shippingAddress.city'] = { $regex: `^${escapeRegex(city)}$`, $options: 'i' };
  if (productId) match['items.product'] = productId;
  return [
    { $match: match },
    { $addFields: { eventAt: { $ifNull: ['$paidAt', '$createdAt'] } } },
    { $match: { eventAt: { $gte: from, $lte: to } } },
  ];
}

function escapeRegex(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function bucketExpr(granularity) {
  const unit = ['day', 'week', 'month', 'year'].includes(granularity) ? granularity : 'day';
  const expr = { $dateTrunc: { date: '$eventAt', unit, timezone: IST } };
  if (unit === 'week') expr.startOfWeek = 'monday';
  return expr;
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

export function revenuePipeline({ from, to, paymentMethod, status, state, city, productId, granularity = 'day' }) {
  const prefix = buildRevenueMatch({ from, to, paymentMethod, status, state, city, productId });
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
              _id: {
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
              },
              orders: { $sum: 1 },
              collected: { $sum: { $ifNull: ['$total', 0] } },
            },
          },
        ],
      },
    },
  ];
}

export function kpiPipeline({ from, to }) {
  return [
    ...buildRevenueMatch({ from, to }),
    { $group: { _id: null, ...orderMetrics } },
  ];
}

export function refundPipeline({ from, to }) {
  return [
    { $match: { paymentStatus: 'refunded' } },
    { $addFields: { eventAt: { $ifNull: ['$paidAt', '$createdAt'] } } },
    { $match: { eventAt: { $gte: from, $lte: to } } },
    { $group: { _id: null, amount: { $sum: { $ifNull: ['$total', 0] } }, orders: { $sum: 1 } } },
  ];
}

export function paymentOutcomePipeline({ from, to }) {
  return [
    { $addFields: { eventAt: { $ifNull: ['$paidAt', '$createdAt'] } } },
    { $match: { eventAt: { $gte: from, $lte: to } } },
    { $group: { _id: { $ifNull: ['$paymentStatus', 'pending'] }, orders: { $sum: 1 }, amount: { $sum: { $ifNull: ['$total', 0] } } } },
  ];
}

export function filterOptionPipeline({ from, to }) {
  return [
    ...buildRevenueMatch({ from, to }),
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
      },
    },
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
  };
}

export function shapeKpis(row = {}, previous = {}, refund = {}) {
  const collected = Number(row.collected || 0);
  const previousCollected = Number(previous.collected || 0);
  const orders = Number(row.orders || 0);
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
  };
}

export function shapeTrend(rows = []) {
  return rows.map((row) => ({
    bucket: row._id ? new Date(row._id).toISOString() : null,
    label: row._id ? formatIstDateInput(row._id) : '',
    collected: Number(row.collected || 0),
    orders: Number(row.orders || 0),
    units: Number(row.units || 0),
    productSales: Number(row.productSales || 0),
  }));
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
  return withShare(rows.map((row) => ({
    id: row.productId ? String(row.productId) : '',
    title: row.title || 'Deleted product',
    image: row.image || '',
    units: Number(row.units || 0),
    revenue: Number(row.revenue || 0),
    orders: Number(row.orders || 0),
    averagePrice: row.units ? Number(row.revenue || 0) / Number(row.units) : 0,
  })), 'revenue');
}

export function shapeInsights({ kpis, trend, states, hours, weekdays, products }) {
  if (!kpis.paidOrders) return ['No paid, non-cancelled orders in this period.'];
  const topDay = [...trend].sort((a, b) => b.collected - a.collected)[0];
  const peakHour = [...hours].sort((a, b) => b.orders - a.orders || b.collected - a.collected)[0];
  const lowHour = [...hours].sort((a, b) => a.orders - b.orders || a.collected - b.collected)[0];
  const topWeekday = [...weekdays].sort((a, b) => b.orders - a.orders)[0];
  const topState = states[0];
  const topProduct = products[0];
  const notes = [];
  if (topDay?.collected) notes.push(`Highest collected revenue day: ${topDay.label} (${Math.round(topDay.collected)}).`);
  if (peakHour) notes.push(`Busiest payment hour (IST): ${peakHour.label} with ${peakHour.orders} paid orders.`);
  if (lowHour) notes.push(`Quietest payment hour (IST): ${lowHour.label}.`);
  if (topWeekday) notes.push(`Busiest weekday: ${topWeekday.weekday}.`);
  if (topState?.label) notes.push(`Highest-revenue state: ${topState.label}.`);
  if (topProduct?.title) notes.push(`Highest-revenue product: ${topProduct.title}.`);
  if (kpis.revenueGrowthPct === null) notes.push('Revenue growth is omitted because the previous period had zero collected revenue.');
  else notes.push(`Collected revenue changed ${kpis.revenueGrowthPct}% versus the previous equivalent period.`);
  return notes;
}

export { IST, WEEKDAYS, STATUS_GROUPS };
