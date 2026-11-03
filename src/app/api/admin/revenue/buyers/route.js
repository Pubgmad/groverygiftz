export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import Order from '@/models/Order';
import Product from '@/models/Product';
import Customer from '@/models/Customer';
import {
  DATE_PRESETS,
  buildRevenueMatch,
  buyerIdentityExpr,
  buyerListPipeline,
  presetToRange,
} from '@/lib/revenueAnalytics';

function parseProductId(value) {
  if (value && mongoose.Types.ObjectId.isValid(value) && String(new mongoose.Types.ObjectId(value)) === String(value)) {
    return new mongoose.Types.ObjectId(value);
  }
  return null;
}

function flattenTitles(rows = []) {
  return [...new Set((rows || []).flat(2).map((title) => String(title || '').trim()).filter(Boolean))];
}

function parseFilters(searchParams) {
  const preset = searchParams.get('preset') || 'last30';
  const range = presetToRange(preset, searchParams.get('from'), searchParams.get('to'));
  if (!range) return { error: 'Choose a valid date range' };
  if (!DATE_PRESETS.some((item) => item.id === preset) && preset !== 'custom') return { error: 'Invalid date preset' };
  const product = parseProductId(searchParams.get('product') || '');
  return {
    preset,
    range,
    filters: {
      from: range.from,
      to: range.to,
      paymentMethod: searchParams.get('paymentMethod') || undefined,
      status: searchParams.get('status') || undefined,
      state: searchParams.get('state') || undefined,
      city: searchParams.get('city') || undefined,
      productId: product || undefined,
      variant: searchParams.get('variant') || undefined,
    },
  };
}

async function hydrateBuyers(rows) {
  const ids = rows.map((row) => row.customerId).filter(Boolean);
  const customers = ids.length
    ? await Customer.find({ _id: { $in: ids } }).select('name email phone').lean()
    : [];
  const byId = Object.fromEntries(customers.map((row) => [String(row._id), row]));
  return rows.map((row) => {
    const account = row.customerId ? byId[String(row.customerId)] : null;
    return {
      key: row._id,
      name: account?.name || row.name || 'Customer',
      email: account?.email || row.email || '',
      phone: account?.phone || row.phone || '',
      orders: Number(row.orders || 0),
      collected: Number(row.collected || 0),
      firstAt: row.firstAt,
      lastAt: row.lastAt,
      products: flattenTitles(row.itemTitles),
    };
  });
}

export async function GET(req) {
  const { requireAdminPermission } = await import('@/lib/adminAccess');
  const { error } = await requireAdminPermission('revenue', 'read');
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const parsed = parseFilters(searchParams);
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const kind = searchParams.get('kind') || 'unique';
  const buyerKey = searchParams.get('buyerKey') || '';
  const search = String(searchParams.get('search') || '').trim().toLowerCase();
  const sort = searchParams.get('sort') || 'spent';
  const page = Math.max(1, Number(searchParams.get('page') || 1));
  const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') || 20)));

  await dbConnect();
  const pipeline = buyerListPipeline(parsed.filters);
  const collection = searchParams.get('collection') || '';
  if (collection && mongoose.Types.ObjectId.isValid(collection)) {
    const inCollection = await Product.find({ collections: collection }).select('_id').lean();
    const ids = inCollection.map((row) => row._id);
    if (!ids.length) {
      return NextResponse.json({ buyers: [], total: 0, pages: 1, page, kind }, { headers: { 'Cache-Control': 'no-store' } });
    }
    pipeline.unshift({ $match: { 'items.product': { $in: ids } } });
  }

  const rows = await Order.aggregate(pipeline).allowDiskUse(true);

  if (buyerKey) {
    const row = rows.find((item) => item._id === buyerKey);
    if (!row) return NextResponse.json({ error: 'Buyer not found in this period' }, { status: 404 });
    const identityMatch = buyerKey.startsWith('id:')
      ? { customer: parseProductId(buyerKey.slice(3)) }
      : {
        $or: [
          { guestEmail: { $regex: `^${buyerKey.slice(6).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } },
          { 'shippingAddress.email': { $regex: `^${buyerKey.slice(6).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } },
        ],
      };
    const periodOrders = await Order.find({
      _id: { $in: row.orderIds || [] },
    }).select('orderNumber paidAt createdAt status paymentStatus total items title shippingAddress guestEmail').sort({ paidAt: -1, createdAt: -1 }).lean();
    const lifetime = await Order.aggregate([
      { $match: { paymentStatus: 'paid', status: { $nin: ['cancelled'] }, ...identityMatch } },
      { $addFields: { eventAt: { $ifNull: ['$paidAt', '$createdAt'] } } },
      {
        $group: {
          _id: buyerIdentityExpr(),
          orders: { $sum: 1 },
          collected: { $sum: { $ifNull: ['$total', 0] } },
          firstAt: { $min: '$eventAt' },
          lastAt: { $max: '$eventAt' },
          titles: { $push: { $ifNull: ['$items.title', []] } },
        },
      },
    ]).allowDiskUse(true);
    const [hydrated] = await hydrateBuyers([row]);
    const life = lifetime[0] || {};
    const titles = flattenTitles(life.titles);
    const freq = {};
    titles.forEach((title) => { freq[title] = (freq[title] || 0) + 1; });
    const favorite = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];
    return NextResponse.json({
      buyer: hydrated,
      lifetime: {
        orders: Number(life.orders || 0),
        collected: Number(life.collected || 0),
        firstAt: life.firstAt || null,
        lastAt: life.lastAt || null,
        averageOrderValue: life.orders ? Number(life.collected || 0) / Number(life.orders) : 0,
        favoriteProduct: favorite ? favorite[0] : '',
        returning: Number(life.orders || 0) > Number(row.orders || 0) || (life.firstAt && new Date(life.firstAt) < parsed.range.from),
      },
      orders: periodOrders.map((order) => ({
        id: String(order._id),
        orderNumber: order.orderNumber,
        date: order.paidAt || order.createdAt,
        status: order.status,
        paymentStatus: order.paymentStatus,
        total: Number(order.total || 0),
        items: (order.items || []).map((item) => ({
          title: item.title,
          image: item.image,
          variant: item.variant || '',
          quantity: item.quantity,
          price: item.price,
        })),
      })),
    }, { headers: { 'Cache-Control': 'no-store' } });
  }

  let filtered = rows;
  if (kind === 'repeat') filtered = rows.filter((row) => Number(row.orders || 0) > 1);
  if (kind === 'returning') {
    const keys = rows.map((row) => row._id);
    const earlier = keys.length ? await Order.aggregate([
      ...buildRevenueMatch({
        ...parsed.filters,
        from: new Date('2000-01-01T00:00:00.000Z'),
        to: new Date(parsed.range.from.getTime() - 1),
      }),
      { $group: { _id: buyerIdentityExpr() } },
      { $match: { _id: { $in: keys } } },
    ]).allowDiskUse(true) : [];
    const returning = new Set(earlier.map((row) => row._id));
    filtered = rows.filter((row) => returning.has(row._id));
  }

  let buyers = await hydrateBuyers(filtered);
  if (search) {
    buyers = buyers.filter((row) => (
      row.name.toLowerCase().includes(search)
      || row.email.toLowerCase().includes(search)
      || row.phone.toLowerCase().includes(search)
    ));
  }
  buyers.sort((a, b) => {
    if (sort === 'orders') return b.orders - a.orders;
    if (sort === 'last') return new Date(b.lastAt || 0) - new Date(a.lastAt || 0);
    return b.collected - a.collected;
  });
  const total = buyers.length;
  const pages = Math.max(1, Math.ceil(total / limit));
  return NextResponse.json({
    kind,
    total,
    pages,
    page,
    buyers: buyers.slice((page - 1) * limit, page * limit),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
