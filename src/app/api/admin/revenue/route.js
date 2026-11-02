export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import Order from '@/models/Order';
import Product from '@/models/Product';
import Collection from '@/models/Collection';
import {
  DATE_PRESETS,
  REVENUE_DEFINITIONS,
  filterOptionPipeline,
  kpiPipeline,
  paymentOutcomePipeline,
  presetToRange,
  previousEquivalentRange,
  refundPipeline,
  revenuePipeline,
  shapeFilterOptions,
  shapeHeatmap,
  shapeHours,
  shapeInsights,
  shapeKpis,
  shapePlaces,
  shapeProducts,
  shapeTrend,
  shapeWeekdays,
} from '@/lib/revenueAnalytics';

function emptyAnalytics(range, preset, granularity, options, insights) {
  return {
    empty: true,
    definitions: REVENUE_DEFINITIONS,
    range: { from: range.fromStr, to: range.toStr, preset, granularity },
    kpis: shapeKpis(),
    trend: [],
    states: [],
    cities: [],
    hours: shapeHours(),
    weekdays: shapeWeekdays(),
    heatmap: shapeHeatmap(),
    products: [],
    variants: [],
    payments: [],
    statuses: [],
    paymentOutcomes: [],
    customers: { unique: 0, repeatInPeriod: 0, repeatRate: 0, revenueFromRepeat: 0 },
    collections: [],
    insights,
    options,
    limitations: [REVENUE_DEFINITIONS.district, REVENUE_DEFINITIONS.collections],
  };
}

function parseProductId(value) {
  if (value && mongoose.Types.ObjectId.isValid(value) && String(new mongoose.Types.ObjectId(value)) === String(value)) {
    return new mongoose.Types.ObjectId(value);
  }
  return null;
}

export async function GET(req) {
  const { requireAdminPermission } = await import('@/lib/adminAccess');
  const { error } = await requireAdminPermission('revenue', 'read');
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const preset = searchParams.get('preset') || 'last30';
  const granularity = searchParams.get('granularity') || 'day';
  const paymentMethod = searchParams.get('paymentMethod') || '';
  const status = searchParams.get('status') || '';
  const state = searchParams.get('state') || '';
  const city = searchParams.get('city') || '';
  const product = searchParams.get('product') || '';
  const collection = searchParams.get('collection') || '';
  const range = presetToRange(preset, searchParams.get('from'), searchParams.get('to'));
  if (!range) return NextResponse.json({ error: 'Choose a valid date range' }, { status: 400 });
  if (!DATE_PRESETS.some((item) => item.id === preset) && preset !== 'custom') {
    return NextResponse.json({ error: 'Invalid date preset' }, { status: 400 });
  }

  await dbConnect();
  const collections = await Collection.find().select('name').sort({ name: 1 }).lean();
  const [optionFacet] = await Order.aggregate(filterOptionPipeline(range)).allowDiskUse(true);
  const filterOptions = shapeFilterOptions(optionFacet, collections);

  if (searchParams.get('optionsOnly') === '1') {
    return NextResponse.json({ options: filterOptions }, { headers: { 'Cache-Control': 'no-store' } });
  }

  const productId = parseProductId(product);
  let productIds = productId ? [productId] : [];
  if (collection && mongoose.Types.ObjectId.isValid(collection)) {
    const inCollection = await Product.find({ collections: collection }).select('_id').lean();
    const ids = inCollection.map((row) => row._id);
    if (!ids.length) {
      return NextResponse.json(
        emptyAnalytics(range, preset, granularity, filterOptions, ['No products currently belong to this collection.']),
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }
    if (productId && !ids.some((id) => String(id) === String(productId))) {
      return NextResponse.json(
        emptyAnalytics(range, preset, granularity, filterOptions, ['No paid orders match this collection and product filter.']),
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }
    productIds = productId ? [productId] : ids;
  }

  const filters = {
    from: range.from,
    to: range.to,
    paymentMethod: paymentMethod || undefined,
    status: status || undefined,
    state: state || undefined,
    city: city || undefined,
    productId: productIds.length === 1 ? productIds[0] : undefined,
    granularity,
  };

  const matchExtra = productIds.length > 1 ? { 'items.product': { $in: productIds } } : null;
  const pipeline = revenuePipeline(filters);
  if (matchExtra) pipeline.unshift({ $match: matchExtra });

  const previous = previousEquivalentRange(range.fromStr, range.toStr);
  const [facet] = await Order.aggregate(pipeline).allowDiskUse(true);
  const [previousKpi] = previous ? await Order.aggregate(kpiPipeline(previous)).allowDiskUse(true) : [{}];
  const [refund] = await Order.aggregate(refundPipeline(range)).allowDiskUse(true);
  const paymentOutcomes = await Order.aggregate(paymentOutcomePipeline(range)).allowDiskUse(true);

  const kpis = shapeKpis(facet?.kpis?.[0], previousKpi, refund);
  const products = shapeProducts(facet?.products || []);
  const states = shapePlaces(facet?.states || [], 'state');
  const cities = shapePlaces(facet?.cities || [], 'city');
  const hours = shapeHours(facet?.hours || []);
  const weekdays = shapeWeekdays(facet?.weekdays || []);
  const trend = shapeTrend(facet?.trend || []);
  const customerRows = (facet?.customers || []).filter((row) => row._id && row._id !== 'unknown');
  const unique = customerRows.length;
  const repeatRows = customerRows.filter((row) => Number(row.orders || 0) > 1);
  const topProduct = products[0] || null;
  kpis.topProduct = topProduct ? { title: topProduct.title, units: topProduct.units, revenue: topProduct.revenue } : null;

  let collectionStats = [];
  if (!collection) {
    const soldIds = products.map((row) => row.id).filter(Boolean);
    if (soldIds.length) {
      const mapped = await Product.find({ _id: { $in: soldIds } }).select('collections').lean();
      const byProduct = Object.fromEntries(mapped.map((row) => [String(row._id), (row.collections || []).map(String)]));
      const named = Object.fromEntries(collections.map((row) => [String(row._id), row.name]));
      const bucket = {};
      products.forEach((productRow) => {
        const ids = byProduct[productRow.id] || [];
        ids.forEach((id) => {
          if (!bucket[id]) bucket[id] = { id, name: named[id] || 'Collection', units: 0, revenue: 0 };
          bucket[id].units += productRow.units;
          bucket[id].revenue += productRow.revenue;
        });
      });
      collectionStats = Object.values(bucket).sort((a, b) => b.revenue - a.revenue).slice(0, 20);
    }
  }

  return NextResponse.json({
    definitions: REVENUE_DEFINITIONS,
    range: { from: range.fromStr, to: range.toStr, previousFrom: previous?.fromStr, previousTo: previous?.toStr, preset, granularity },
    kpis,
    trend,
    states,
    cities,
    hours,
    weekdays,
    heatmap: shapeHeatmap(facet?.heatmap || []),
    products,
    variants: (facet?.variants || []).map((row) => ({
      title: row._id?.title || 'Product',
      variant: row._id?.variant || '',
      units: Number(row.units || 0),
      revenue: Number(row.revenue || 0),
    })),
    payments: (facet?.payments || []).map((row) => ({
      method: row._id || 'Cashfree',
      collected: Number(row.collected || 0),
      orders: Number(row.orders || 0),
    })),
    statuses: (facet?.statuses || []).map((row) => ({
      status: row._id || 'ordered',
      orders: Number(row.orders || 0),
      collected: Number(row.collected || 0),
    })),
    paymentOutcomes: paymentOutcomes.map((row) => ({
      status: row._id || 'pending',
      orders: Number(row.orders || 0),
      amount: Number(row.amount || 0),
    })),
    customers: {
      unique,
      repeatInPeriod: repeatRows.length,
      repeatRate: unique ? Math.round((repeatRows.length / unique) * 1000) / 10 : 0,
      revenueFromRepeat: repeatRows.reduce((sum, row) => sum + Number(row.collected || 0), 0),
    },
    collections: collectionStats,
    insights: shapeInsights({ kpis, trend, states, hours, weekdays, products }),
    options: filterOptions,
    limitations: [
      'District is not stored on orders and is not inferred from pincode or city.',
      'Profit is not shown because product cost is not stored.',
      'No Razorpay or COD orders exist in the current checkout flow; payment method is recorded from the order document, usually Cashfree.',
      'Collection totals can overlap when a product belongs to more than one collection. Those totals are contribution views, not additive revenue.',
      'Repeat-customer rate counts buyers with two or more paid orders inside the selected period only.',
    ],
  }, { headers: { 'Cache-Control': 'no-store' } });
}
