import Order from '@/models/Order';
import Product from '@/models/Product';
import MakingCost from '@/models/MakingCost';
import MakingCostHistory from '@/models/MakingCostHistory';
import {
  COST_SOURCE,
  backdateInauguralHistoryForAttribution,
  buildAttributedRows,
  groupProfitRows,
  normalizeVariantKey,
  summarizeAttributedItems,
} from '@/lib/makingCost';
import { istBucketLabel, normalizePlaceLabel, profitItemPipeline } from '@/lib/revenueAnalytics';

export async function attributeProfitForFilters(filters, extraMatch = null) {
  const pipeline = profitItemPipeline(filters);
  if (extraMatch) pipeline.unshift(extraMatch);
  const items = await Order.aggregate(pipeline).allowDiskUse(true);
  const productIds = [...new Set(items.map((row) => row.product).filter(Boolean))];
  const [products, histories, currentCosts] = await Promise.all([
    productIds.length ? Product.find({ _id: { $in: productIds } }).select('title variants images createdAt').lean() : [],
    productIds.length
      ? MakingCostHistory.find({ product: { $in: productIds } }).sort({ effectiveFrom: 1, createdAt: 1 }).lean()
      : [],
    productIds.length ? MakingCost.find({ product: { $in: productIds } }).lean() : [],
  ]);
  const productsById = Object.fromEntries(products.map((row) => [String(row._id), row]));
  const historyByProduct = {};
  histories.forEach((row) => {
    const key = String(row.product);
    if (!historyByProduct[key]) historyByProduct[key] = [];
    historyByProduct[key].push(row);
  });
  // If a live MakingCost row has no history (legacy saves), apply it from product creation
  // so period filters include known production cost instead of silently showing ₹0 profit.
  // When history exists for that key, history alone remains the source of truth.
  currentCosts.forEach((row) => {
    const key = String(row.product);
    const variantKey = normalizeVariantKey(row.variantKey || '');
    const rows = historyByProduct[key] || [];
    const hasHistory = rows.some((entry) => normalizeVariantKey(entry.variantKey || '') === variantKey);
    if (hasHistory) return;
    const product = productsById[key];
    const effectiveFrom = product?.createdAt ? new Date(product.createdAt) : new Date('2020-01-01T00:00:00.000Z');
    if (!historyByProduct[key]) historyByProduct[key] = [];
    // Legacy live cost with no history: treat like inaugural backdate so "strict"
    // coverage never counts synthetic rows as dated history confirmation.
    historyByProduct[key].push({
      product: row.product,
      variantKey: row.variantKey || '',
      variantName: row.variantName || '',
      optionLabel: row.optionLabel || '',
      amount: row.amount,
      effectiveFrom,
      analyticsBackdatedFrom: row.updatedAt || row.createdAt || new Date(),
      source: COST_SOURCE.historyBackdated,
    });
  });
  backdateInauguralHistoryForAttribution(historyByProduct, productsById);
  const attributed = buildAttributedRows(items, productsById, historyByProduct);
  const summary = summarizeAttributedItems(attributed);
  const productRows = groupProfitRows(attributed, (row) => row.productId || row.title, (row) => row.title);
  const variantRows = groupProfitRows(
    attributed.filter((row) => row.variant),
    (row) => `${row.title}|${row.variant}`,
    (row) => `${row.title} · ${row.variant}`,
  );
  const stateRows = groupProfitRows(
    attributed,
    (row) => normalizePlaceLabel(row.state || 'Unknown').toLowerCase(),
    (row) => normalizePlaceLabel(row.state) || 'Unknown',
  );
  const cityRows = groupProfitRows(
    attributed,
    (row) => `${normalizePlaceLabel(row.city || 'Unknown').toLowerCase()}|${normalizePlaceLabel(row.state || '').toLowerCase()}`,
    (row) => normalizePlaceLabel(row.city) || 'Unknown',
  );
  const trendRows = groupProfitRows(
    attributed,
    (row) => istBucketLabel(row.eventAt, filters.granularity || 'day'),
    (row) => istBucketLabel(row.eventAt, filters.granularity || 'day'),
  ).sort((a, b) => String(a.label).localeCompare(String(b.label)));
  const knownProducts = productRows.filter((row) => Number(row.knownCostUnits || 0) > 0 || Number(row.knownRevenue || 0) > 0);
  return {
    attributed,
    summary,
    productRows,
    variantRows,
    stateRows,
    cityRows,
    trendRows,
    mostProfitableProduct: knownProducts[0] ? { id: knownProducts[0].id, title: knownProducts[0].label, grossProfit: knownProducts[0].grossProfit, marginPct: knownProducts[0].marginPct } : null,
    leastProfitableProduct: knownProducts.length ? { id: knownProducts[knownProducts.length - 1].id, title: knownProducts[knownProducts.length - 1].label, grossProfit: knownProducts[knownProducts.length - 1].grossProfit, marginPct: knownProducts[knownProducts.length - 1].marginPct } : null,
    peakProfitDay: [...trendRows].sort((a, b) => b.grossProfit - a.grossProfit)[0] || null,
  };
}
