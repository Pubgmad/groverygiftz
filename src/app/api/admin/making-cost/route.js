export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Product from '@/models/Product';
import MakingCost from '@/models/MakingCost';
import { displayMakingCostAmount, findCostRow, makingCostStatusForProduct, variantCostKey } from '@/lib/makingCost';

function escapeRegex(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function GET(req) {
  const { requireAdminPermission } = await import('@/lib/adminAccess');
  const { error } = await requireAdminPermission('making-cost', 'read');
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const search = String(searchParams.get('search') || '').trim();
  const status = searchParams.get('status') || 'all';
  const page = Math.max(1, Number(searchParams.get('page') || 1));
  const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') || 20)));

  await dbConnect();
  const query = {};
  if (search) {
    const or = [{ title: { $regex: escapeRegex(search), $options: 'i' } }];
    if (/^[a-fA-F0-9]{24}$/.test(search)) or.push({ _id: search });
    query.$or = or;
  }

  const products = await Product.find(query)
    .select('title slug images regularPrice salePrice variants collections isActive updatedAt')
    .populate('collections', 'name')
    .sort({ updatedAt: -1 })
    .lean();

  const costs = await MakingCost.find({ product: { $in: products.map((row) => row._id) } }).lean();
  const costsByProduct = new Map();
  costs.forEach((row) => {
    const key = String(row.product);
    if (!costsByProduct.has(key)) costsByProduct.set(key, []);
    costsByProduct.get(key).push(row);
  });

  const rows = products.map((product) => {
    const productCosts = costsByProduct.get(String(product._id)) || [];
    const variantOptions = (product.variants || []).flatMap((variant) => (variant.options || []).map((option) => {
      const key = variantCostKey(variant.name, option.label);
      const cost = findCostRow(productCosts, key);
      return {
        variantName: variant.name || '',
        optionLabel: option.label || '',
        variantKey: key,
        regularPrice: option.useOwnPrice ? option.regularPrice : product.regularPrice,
        salePrice: option.useOwnPrice ? option.salePrice : product.salePrice,
        makingCost: cost && cost.amount !== null && cost.amount !== undefined ? Number(cost.amount) : null,
        configured: Boolean(cost && cost.amount !== null && cost.amount !== undefined),
        updatedAt: cost?.updatedAt || null,
      };
    }));
    const costStatus = makingCostStatusForProduct(product, productCosts);
    const displayAmount = displayMakingCostAmount(productCosts);
    const latest = productCosts.reduce((max, row) => {
      const time = new Date(row.updatedAt || 0).getTime();
      return time > max ? time : max;
    }, 0);
    return {
      id: String(product._id),
      title: product.title,
      slug: product.slug,
      image: product.images?.[0] || '',
      regularPrice: Number(product.regularPrice || 0),
      salePrice: Number(product.salePrice || 0),
      isActive: product.isActive !== false,
      collections: (product.collections || []).map((row) => row.name).filter(Boolean),
      makingCost: typeof displayAmount === 'number' ? displayAmount : null,
      makingCostRange: displayAmount && typeof displayAmount === 'object' ? displayAmount : null,
      costStatus,
      variants: variantOptions,
      lastUpdated: latest ? new Date(latest).toISOString() : (product.updatedAt ? new Date(product.updatedAt).toISOString() : null),
    };
  }).filter((row) => {
    if (status === 'missing') return row.costStatus === 'missing';
    if (status === 'partial') return row.costStatus === 'partial';
    if (status === 'configured') return row.costStatus === 'configured';
    return true;
  });

  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / limit));
  const paged = rows.slice((page - 1) * limit, page * limit);
  const missing = rows.filter((row) => row.costStatus !== 'configured').length;

  return NextResponse.json({
    products: paged,
    total,
    pages,
    page,
    missing,
    definitions: {
      unknown: 'Missing making cost is unknown, never treated as ₹0.',
      fallback: 'If a purchased variant has no variant making cost, the product-level making cost is used. If that is also missing, profit for that item is unknown. Partial multi-axis variant costs (some options priced, others not) stay unknown so production cost is never understated.',
      history: 'Saving a cost records when it starts applying. For the first-ever cost on a product or variant, analytics and new saves use the product creation date as the start. Later changes use the effective date you enter. Revenue Analytics may apply an inaugural cost from product creation in memory when an older history row was saved with a later date; MongoDB history is not rewritten. Strict coverage counts only checkout snapshots and non-backdated history.',
    },
  }, { headers: { 'Cache-Control': 'no-store' } });
}
