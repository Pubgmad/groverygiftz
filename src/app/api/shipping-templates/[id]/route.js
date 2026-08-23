import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import dbConnect from '@/lib/db';
import ShippingTemplate from '@/models/ShippingTemplate';
import Product from '@/models/Product';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sanitizeShippingTemplatePayload } from '@/lib/shippingTemplatePayload';

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  return session?.user?.type === 'admin';
}

const templateRatesToOverrides = (rates = []) => (Array.isArray(rates) ? rates : []).map((row) => ({
  state: row.state || '',
  shippingCost: Number(row.shippingCost || 0),
  deliveryEstimate: row.deliveryEstimate || '',
}));

async function syncProductsUsingTemplate(template) {
  const templateId = String(template?._id || '');
  if (!templateId) return [];
  const stateOverrides = templateRatesToOverrides(template.rates);
  const templateRefs = [template._id, templateId];

  await Product.updateMany(
    { 'delivery.shippingTemplate': { $in: templateRefs } },
    { $set: { 'delivery.stateOverrides': stateOverrides } }
  );

  const products = await Product.find({ 'variants.options.shippingTemplate': { $in: templateRefs } });
  const changedSlugs = [];
  for (const product of products) {
    let changed = false;
    product.variants?.forEach((variant) => {
      variant.options?.forEach((option) => {
        if (String(option.shippingTemplate || '') === templateId) {
          option.stateOverrides = stateOverrides.map((row) => ({ ...row }));
          changed = true;
        }
      });
    });
    if (changed) {
      changedSlugs.push(product.slug);
      await product.save();
    }
  }

  const deliveryProducts = await Product.find({ 'delivery.shippingTemplate': { $in: templateRefs } }).select('slug').lean();
  deliveryProducts.forEach((product) => changedSlugs.push(product.slug));
  return [...new Set(changedSlugs.filter(Boolean))];
}

export async function PUT(req, { params }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await dbConnect();
  const { id } = await params;
  const body = sanitizeShippingTemplatePayload(await req.json());
  const template = await ShippingTemplate.findByIdAndUpdate(id, body, { new: true });
  if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const changedSlugs = await syncProductsUsingTemplate(template);
  revalidatePath('/', 'layout');
  revalidatePath('/');
  revalidatePath('/shop');
  changedSlugs.forEach((slug) => revalidatePath('/products/' + slug));
  return NextResponse.json(template);
}

export async function DELETE(req, { params }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await dbConnect();
  const { id } = await params;
  const deleted = await ShippingTemplate.findByIdAndDelete(id);
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ success: true });
}