import Order from '@/models/Order';
import Product from '@/models/Product';
import MakingCostHistory from '@/models/MakingCostHistory';
import { buildAttributedRows, groupProfitRows, summarizeAttributedItems } from '@/lib/makingCost';
import { istBucketLabel, profitItemPipeline } from '@/lib/revenueAnalytics';

export async function attributeProfitForFilters(filters, extraMatch = null) {
  const pipeline = profitItemPipeline(filters);
  if (extraMatch) pipeline.unshift(extraMatch);
  const items = await Order.aggregate(pipeline).allowDiskUse(true);
  const productIds = [...new Set(items.map((row) => row.product).filter(Boolean))];
  const [products, histories] = await Promise.all([
    productIds.length ? Product.find({ _id: { $in: productIds } }).select('title variants images').lean() : [],
    productIds.length ? MakingCostHistory.find({ product: { $in: productIds } }).lean() : [],
  ]);
  const productsById = Object.fromEntries(products.map((row) => [String(row._id), row]));
  const historyByProduct = {};
  histories.forEach((row) => {
    const key = String(row.product);
    if (!historyByProduct[key]) historyByProduct[key] = [];
    historyByProduct[key].push(row);
  });
  const attributed = buildAttributedRows(items, productsById, historyByProduct);
  const summary = summarizeAttributedItems(attributed);
  const productRows = groupProfitRows(attributed, (row) => row.productId || row.title, (row) => row.title);
  const variantRows = groupProfitRows(
    attributed.filter((row) => row.variant),
    (row) => `${row.title}|${row.variant}`,
    (row) => `${row.title} · ${row.variant}`,
  );
  const stateRows = groupProfitRows(attributed, (row) => String(row.state || 'Unknown').toLowerCase(), (row) => row.state || 'Unknown');
  const cityRows = groupProfitRows(
    attributed,
    (row) => `${String(row.city || 'Unknown').toLowerCase()}|${String(row.state || '').toLowerCase()}`,
    (row) => row.city || 'Unknown',
  );
  const trendRows = groupProfitRows(
    attributed,
    (row) => istBucketLabel(row.eventAt, filters.granularity || 'day'),
    (row) => istBucketLabel(row.eventAt, filters.granularity || 'day'),
  ).sort((a, b) => String(a.label).localeCompare(String(b.label)));
  const knownProducts = productRows.filter((row) => row.knownRevenue > 0);
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
