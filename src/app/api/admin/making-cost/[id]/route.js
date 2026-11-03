export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import Product from '@/models/Product';
import MakingCost from '@/models/MakingCost';
import MakingCostHistory from '@/models/MakingCostHistory';
import { normalizeVariantKey, parseMoneyAmount, variantCostKey } from '@/lib/makingCost';
import { istInclusiveRange } from '@/lib/revenueAnalytics';

function parseProductId(value) {
  if (value && mongoose.Types.ObjectId.isValid(value) && String(new mongoose.Types.ObjectId(value)) === String(value)) {
    return new mongoose.Types.ObjectId(value);
  }
  return null;
}

async function loadProduct(id) {
  return Product.findById(id)
    .select('title slug images regularPrice salePrice variants collections isActive createdAt')
    .populate('collections', 'name')
    .lean();
}

export async function GET(req, { params }) {
  const { requireAdminPermission } = await import('@/lib/adminAccess');
  const { error } = await requireAdminPermission('making-cost', 'read');
  if (error) return error;

  const { id } = await params;
  const productId = parseProductId(id);
  if (!productId) return NextResponse.json({ error: 'Invalid product' }, { status: 400 });

  await dbConnect();
  const product = await loadProduct(productId);
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

  const [costs, history] = await Promise.all([
    MakingCost.find({ product: productId }).lean(),
    MakingCostHistory.find({ product: productId }).sort({ effectiveFrom: -1, createdAt: -1 }).limit(40).lean(),
  ]);

  return NextResponse.json({
    product: {
      id: String(product._id),
      title: product.title,
      slug: product.slug,
      image: product.images?.[0] || '',
      createdAt: product.createdAt ? new Date(product.createdAt).toISOString() : null,
      regularPrice: Number(product.regularPrice || 0),
      salePrice: Number(product.salePrice || 0),
      collections: (product.collections || []).map((row) => row.name).filter(Boolean),
      variants: (product.variants || []).flatMap((variant) => (variant.options || []).map((option) => ({
        variantName: variant.name || '',
        optionLabel: option.label || '',
        variantKey: variantCostKey(variant.name, option.label),
        regularPrice: option.useOwnPrice ? option.regularPrice : product.regularPrice,
        salePrice: option.useOwnPrice ? option.salePrice : product.salePrice,
      }))),
    },
    costs: costs.map((row) => ({
      variantKey: row.variantKey || '',
      variantName: row.variantName || '',
      optionLabel: row.optionLabel || '',
      amount: Number(row.amount),
      updatedAt: row.updatedAt,
      updatedByEmail: row.updatedByEmail || '',
    })),
    history: history.map((row) => ({
      variantKey: row.variantKey || '',
      variantName: row.variantName || '',
      optionLabel: row.optionLabel || '',
      amount: Number(row.amount),
      previousAmount: row.previousAmount === null || row.previousAmount === undefined ? null : Number(row.previousAmount),
      effectiveFrom: row.effectiveFrom,
      note: row.note || '',
      updatedByEmail: row.updatedByEmail || '',
      createdAt: row.createdAt,
    })),
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PUT(req, { params }) {
  const { requireAdminPermission, logAdminAudit } = await import('@/lib/adminAccess');
  const { error, access } = await requireAdminPermission('making-cost', 'write');
  if (error) return error;

  const { id } = await params;
  const productId = parseProductId(id);
  if (!productId) return NextResponse.json({ error: 'Invalid product' }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  await dbConnect();
  const product = await loadProduct(productId);
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

  const entries = [];
  if (body.productAmount !== undefined && body.productAmount !== null && String(body.productAmount).trim() !== '') {
    const parsed = parseMoneyAmount(body.productAmount);
    if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });
    entries.push({ variantKey: '', variantName: '', optionLabel: '', amount: parsed.amount });
  }
  if (Array.isArray(body.variants)) {
    for (const row of body.variants) {
      if (row?.amount === undefined || row?.amount === null || String(row.amount).trim() === '') continue;
      const parsed = parseMoneyAmount(row.amount);
      if (parsed.error) return NextResponse.json({ error: `${row.optionLabel || 'Variant'}: ${parsed.error}` }, { status: 400 });
      const variantName = String(row.variantName || '').trim();
      const optionLabel = String(row.optionLabel || '').trim();
      if (!variantName || !optionLabel) return NextResponse.json({ error: 'Variant name and option label are required' }, { status: 400 });
      entries.push({
        variantKey: variantCostKey(variantName, optionLabel),
        variantName,
        optionLabel,
        amount: parsed.amount,
      });
    }
  }
  if (!entries.length) {
    return NextResponse.json({ error: 'Enter at least one making cost to save' }, { status: 400 });
  }

  const dateStr = String(body.effectiveFrom || '').trim();
  const range = dateStr ? istInclusiveRange(dateStr, dateStr) : null;
  const effectiveFrom = range?.from || new Date();
  const note = String(body.note || '').trim().slice(0, 300);
  const actorEmail = access?.email || '';
  const actorId = access?.adminId || access?.sessionUserId || null;

  const existing = await MakingCost.find({ product: productId }).lean();
  const existingByKey = Object.fromEntries(existing.map((row) => [normalizeVariantKey(row.variantKey || ''), row]));
  const historyCounts = await MakingCostHistory.aggregate([
    { $match: { product: productId } },
    { $group: { _id: { $toLower: { $trim: { input: { $ifNull: ['$variantKey', ''] } } } }, count: { $sum: 1 } } },
  ]);
  const historyCountByKey = Object.fromEntries(historyCounts.map((row) => [normalizeVariantKey(row._id || ''), row.count]));

  await Promise.all(entries.map(async (entry) => {
    const previous = existingByKey[normalizeVariantKey(entry.variantKey)];
    // First-ever cost for a key always starts at product creation. The admin date picker
    // only controls later changes. (The UI used to default effectiveFrom to "today" and
    // always send it, which left ~90% of historical revenue as unknown-cost.)
    const hasHistory = Number(historyCountByKey[normalizeVariantKey(entry.variantKey)] || 0) > 0;
    const entryEffectiveFrom = (!hasHistory && product.createdAt)
      ? new Date(product.createdAt)
      : effectiveFrom;
    await MakingCost.findOneAndUpdate(
      { product: productId, variantKey: entry.variantKey },
      {
        product: productId,
        variantKey: entry.variantKey,
        variantName: entry.variantName,
        optionLabel: entry.optionLabel,
        amount: entry.amount,
        updatedBy: actorId,
        updatedByEmail: actorEmail,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    await MakingCostHistory.create({
      product: productId,
      variantKey: entry.variantKey,
      variantName: entry.variantName,
      optionLabel: entry.optionLabel,
      amount: entry.amount,
      previousAmount: previous ? Number(previous.amount) : null,
      effectiveFrom: entryEffectiveFrom,
      note,
      updatedBy: actorId,
      updatedByEmail: actorEmail,
    });
  }));

  await logAdminAudit({
    access,
    req,
    action: 'making-cost.update',
    targetType: 'product',
    targetId: productId,
    details: { title: product.title, entries: entries.map((row) => ({ variantKey: row.variantKey, amount: row.amount })), effectiveFrom },
  });

  return GET(req, { params });
}
