export function stripMakingCostFromItem(item) {
  if (!item || typeof item !== 'object') return item;
  const next = { ...item };
  delete next.makingCost;
  delete next.makingCostStatus;
  delete next.makingCostSource;
  return next;
}

export function stripMakingCostFromOrder(order) {
  if (!order || typeof order !== 'object') return order;
  return {
    ...order,
    items: Array.isArray(order.items) ? order.items.map(stripMakingCostFromItem) : order.items,
  };
}

export const COST_STATUS = {
  known: 'known',
  unknown: 'unknown',
};

export const COST_SOURCE = {
  snapshot: 'snapshot',
  variant: 'variant',
  product: 'product',
  history: 'history',
};

export function isConfiguredCost(value) {
  if (value === null || value === undefined || value === '') return false;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0;
}

export function parseMoneyAmount(value) {
  if (value === null || value === undefined || String(value).trim() === '') {
    return { error: 'Making cost is required' };
  }
  const amount = Math.round(Number(value) * 100) / 100;
  if (!Number.isFinite(amount)) return { error: 'Making cost must be a number' };
  if (amount < 0) return { error: 'Making cost cannot be negative' };
  if (amount > 10000000) return { error: 'Making cost is too large' };
  return { amount };
}

export function variantCostKey(variantName = '', optionLabel = '') {
  const name = String(variantName || '').trim();
  const label = String(optionLabel || '').trim();
  if (!name || !label) return '';
  return `${name}: ${label}`;
}

export function normalizeVariantKey(key = '') {
  return String(key || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function parseVariantSelection(variantText = '') {
  return String(variantText || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((map, part) => {
      const separatorIndex = part.indexOf(':');
      if (separatorIndex === -1) return map;
      const name = String(part.slice(0, separatorIndex) || '').trim();
      const label = String(part.slice(separatorIndex + 1) || '').trim();
      if (name && label) map[normalizeVariantKey(name)] = { name, label };
      return map;
    }, {});
}

function findSelectedVariantOptions(product, variantText = '') {
  const selections = parseVariantSelection(variantText);
  const matched = (product?.variants || []).flatMap((variant) => {
    const selected = selections[normalizeVariantKey(variant?.name)];
    if (!selected) return [];
    const option = (variant.options || []).find((opt) => normalizeVariantKey(opt?.label) === normalizeVariantKey(selected.label));
    return option ? [{ variant, option }] : [];
  });
  if (matched.length) return matched;

  // Legacy / loose snapshots: match option labels when "Name: Label" parsing fails
  // (e.g. stored as "12x18" or "Large" without the axis name).
  const rawParts = String(variantText || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const separatorIndex = part.indexOf(':');
      if (separatorIndex === -1) return normalizeVariantKey(part);
      return normalizeVariantKey(part.slice(separatorIndex + 1));
    })
    .filter(Boolean);
  if (!rawParts.length) return [];

  const byLabel = [];
  (product?.variants || []).forEach((variant) => {
    (variant.options || []).forEach((option) => {
      if (rawParts.includes(normalizeVariantKey(option?.label))) {
        byLabel.push({ variant, option });
      }
    });
  });
  return byLabel;
}

export function findCostRow(costs = [], variantKey = '') {
  const target = normalizeVariantKey(variantKey);
  return (costs || []).find((row) => normalizeVariantKey(row?.variantKey || '') === target) || null;
}

export function costsEffectiveAt(rows = [], at = null) {
  const map = new Map();
  rows.forEach((row) => {
    if (row?.cleared) return;
    if (!isConfiguredCost(row?.amount)) return;
    if (at && row.effectiveFrom && new Date(row.effectiveFrom).getTime() > new Date(at).getTime()) return;
    const key = normalizeVariantKey(row.variantKey || '');
    const previous = map.get(key);
    const rowTime = new Date(row.effectiveFrom || row.updatedAt || 0).getTime();
    const prevTime = previous ? new Date(previous.effectiveFrom || previous.updatedAt || 0).getTime() : -1;
    if (!previous || rowTime >= prevTime) map.set(key, row);
  });
  return map;
}

export function resolveMakingCost({ product, variantText = '', costs = [], at = null } = {}) {
  const byKey = costsEffectiveAt(costs, at);
  const selected = findSelectedVariantOptions(product, variantText);
  const optionRows = selected
    .map(({ variant, option }) => byKey.get(normalizeVariantKey(variantCostKey(variant.name, option.label))))
    .filter(Boolean);

  // All selected axes must have a cost. Partial multi-option matches stay unknown
  // so we never understate production cost. If none match, fall back to product-level.
  if (selected.length > 0 && optionRows.length === selected.length) {
    const amount = optionRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    return {
      status: COST_STATUS.known,
      amount,
      source: optionRows.some((row) => row.source === COST_SOURCE.history || row.effectiveFrom) ? COST_SOURCE.history : COST_SOURCE.variant,
      keys: optionRows.map((row) => row.variantKey || ''),
    };
  }

  if (selected.length > 0 && optionRows.length > 0 && optionRows.length < selected.length) {
    return {
      status: COST_STATUS.unknown,
      amount: null,
      source: null,
      keys: [],
      reason: 'partial_variant_cost',
    };
  }

  const productRow = byKey.get('');
  if (productRow) {
    return {
      status: COST_STATUS.known,
      amount: Number(productRow.amount),
      source: productRow.source === COST_SOURCE.history || productRow.effectiveFrom ? COST_SOURCE.history : COST_SOURCE.product,
      keys: [''],
    };
  }

  return {
    status: COST_STATUS.unknown,
    amount: null,
    source: null,
    keys: [],
  };
}

export function snapshotOrderItemCost(item, product, costs = []) {
  const resolved = resolveMakingCost({
    product,
    variantText: item?.variant || '',
    costs,
    at: null,
  });
  if (resolved.status === COST_STATUS.known) {
    return {
      makingCost: resolved.amount,
      makingCostStatus: COST_STATUS.known,
      makingCostSource: resolved.source,
    };
  }
  return {
    makingCost: undefined,
    makingCostStatus: COST_STATUS.unknown,
    makingCostSource: undefined,
  };
}

export function attributeItemCost(item, product, costs = [], at = null) {
  if (item?.makingCostStatus === COST_STATUS.known && isConfiguredCost(item.makingCost)) {
    return {
      status: COST_STATUS.known,
      amount: Number(item.makingCost),
      source: COST_SOURCE.snapshot,
    };
  }
  const resolved = resolveMakingCost({
    product,
    variantText: item?.variant || '',
    costs,
    at,
  });
  if (resolved.status === COST_STATUS.known) {
    return {
      status: COST_STATUS.known,
      amount: resolved.amount,
      source: COST_SOURCE.history,
    };
  }
  return {
    status: COST_STATUS.unknown,
    amount: null,
    source: null,
  };
}

export function lineRevenue(item = {}) {
  return Number(item.price || 0) * Number(item.quantity || 0);
}

export function summarizeAttributedItems(rows = []) {
  const summary = {
    units: 0,
    productRevenue: 0,
    knownCostRevenue: 0,
    unknownCostRevenue: 0,
    makingCostKnown: 0,
    productGrossProfit: 0,
    unknownCostUnits: 0,
    knownCostUnits: 0,
    unknownCostLineCount: 0,
    knownCostLineCount: 0,
  };
  rows.forEach((row) => {
    const units = Number(row.quantity || 0);
    const revenue = Number(row.revenue || 0);
    summary.units += units;
    summary.productRevenue += revenue;
    if (row.status === COST_STATUS.known) {
      const cost = Number(row.makingCost || 0) * units;
      summary.knownCostRevenue += revenue;
      summary.makingCostKnown += cost;
      summary.productGrossProfit += revenue - cost;
      summary.knownCostUnits += units;
      summary.knownCostLineCount += 1;
    } else {
      summary.unknownCostRevenue += revenue;
      summary.unknownCostUnits += units;
      summary.unknownCostLineCount += 1;
    }
  });
  const coveragePct = summary.productRevenue
    ? Math.round((summary.knownCostRevenue / summary.productRevenue) * 1000) / 10
    : 100;
  const grossMarginPct = summary.knownCostRevenue
    ? Math.round((summary.productGrossProfit / summary.knownCostRevenue) * 1000) / 10
    : null;
  return {
    ...summary,
    costCoveragePct: coveragePct,
    grossMarginPct,
    complete: summary.unknownCostLineCount === 0,
  };
}

export function groupProfitRows(rows = [], keyFn, labelFn) {
  const map = new Map();
  rows.forEach((row) => {
    const key = keyFn(row);
    if (!map.has(key)) {
      map.set(key, {
        key,
        label: labelFn(row),
        units: 0,
        revenue: 0,
        makingCost: 0,
        grossProfit: 0,
        knownRevenue: 0,
        unknownRevenue: 0,
        orders: new Set(),
        image: row.image || '',
        id: row.productId || '',
        variant: row.variant || '',
        state: row.state || '',
        city: row.city || '',
      });
    }
    const bucket = map.get(key);
    const units = Number(row.quantity || 0);
    const revenue = Number(row.revenue || 0);
    bucket.units += units;
    bucket.revenue += revenue;
    if (row.orderId) bucket.orders.add(String(row.orderId));
    if (row.status === COST_STATUS.known) {
      const cost = Number(row.makingCost || 0) * units;
      bucket.makingCost += cost;
      bucket.grossProfit += revenue - cost;
      bucket.knownRevenue += revenue;
    } else {
      bucket.unknownRevenue += revenue;
    }
  });
  return [...map.values()]
    .map((row) => ({
      ...row,
      orders: row.orders.size,
      marginPct: row.knownRevenue ? Math.round((row.grossProfit / row.knownRevenue) * 1000) / 10 : null,
      costCoveragePct: row.revenue ? Math.round((row.knownRevenue / row.revenue) * 1000) / 10 : 100,
    }))
    .sort((a, b) => b.grossProfit - a.grossProfit || b.revenue - a.revenue);
}

export function buildAttributedRows(items = [], productsById = {}, historyByProduct = {}) {
  return items.map((item) => {
    const productId = item.product ? String(item.product) : '';
    const product = productsById[productId] || { title: item.title, variants: [] };
    const attributed = attributeItemCost(
      {
        makingCost: item.snapshotCost,
        makingCostStatus: item.snapshotStatus,
        variant: item.variant,
        price: item.price,
        quantity: item.quantity,
      },
      product,
      historyByProduct[productId] || [],
      item.eventAt,
    );
    return {
      orderId: item.orderId,
      eventAt: item.eventAt,
      productId,
      title: item.title || product.title || 'Deleted product',
      image: item.image || '',
      variant: item.variant || '',
      quantity: Number(item.quantity || 0),
      price: Number(item.price || 0),
      revenue: Number(item.price || 0) * Number(item.quantity || 0),
      makingCost: attributed.amount,
      status: attributed.status,
      source: attributed.source,
      state: item.state || '',
      city: item.city || '',
    };
  });
}

export function makingCostStatusForProduct(product, costs = []) {
  const hasProduct = costs.some((row) => !row.variantKey && isConfiguredCost(row.amount));
  const variantOptions = (product?.variants || []).flatMap((variant) => (variant.options || []).map((option) => ({
    variantName: variant.name,
    optionLabel: option.label,
    key: variantCostKey(variant.name, option.label),
  })));
  const configuredVariants = variantOptions.filter((option) => costs.some((row) => (
    normalizeVariantKey(row.variantKey) === normalizeVariantKey(option.key) && isConfiguredCost(row.amount)
  )));
  if (!variantOptions.length) {
    return hasProduct ? 'configured' : 'missing';
  }
  if (configuredVariants.length === variantOptions.length) return 'configured';
  if (configuredVariants.length > 0 || hasProduct) return 'partial';
  return 'missing';
}
