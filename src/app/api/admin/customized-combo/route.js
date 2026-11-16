export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import Product from '@/models/Product';
import Settings from '@/models/Settings';
import { requireAdminPermission } from '@/lib/adminAccess';
import {
  COMBO_SOURCE_PRODUCT_TITLE_RX,
  extractSizeOptionsFromProduct,
} from '@/lib/customizedCombo';

/**
 * GET: Customized Combo source product + all configured variants/sizes.
 * Does not mutate products. Prefer Settings.whatsappComboProductId when set.
 */
export async function GET() {
  const { error } = await requireAdminPermission('orders', 'read');
  if (error) return error;
  await dbConnect();

  const settings = await Settings.findOne().select('whatsappComboProductId').lean();
  let product = null;
  const configuredId = String(settings?.whatsappComboProductId || '').trim();
  if (configuredId && mongoose.Types.ObjectId.isValid(configuredId)) {
    product = await Product.findOne({
      _id: configuredId,
      isActive: { $ne: false },
    });
  }
  if (!product) {
    product = await Product.findOne({
      title: COMBO_SOURCE_PRODUCT_TITLE_RX,
      isActive: { $ne: false },
    });
  }

  if (!product) {
    return NextResponse.json({
      error: 'Customized Combo source product is not configured. Set Settings.whatsappComboProductId or ensure the combo frame product exists.',
      product: null,
      sizes: [],
      options: [],
    }, { status: 404 });
  }

  const { variantName, options } = extractSizeOptionsFromProduct(product);
  const sizes = options
    .map((o) => o.label)
    .sort((a, b) => {
      const na = String(a).toLowerCase().replace(/×/g, 'x').match(/(\d+)\s*x\s*(\d+)/);
      const nb = String(b).toLowerCase().replace(/×/g, 'x').match(/(\d+)\s*x\s*(\d+)/);
      if (na && nb) {
        const da = Number(na[1]) * Number(na[2]);
        const db = Number(nb[1]) * Number(nb[2]);
        if (da !== db) return da - db;
        return Number(na[1]) - Number(nb[1]);
      }
      return String(a).localeCompare(String(b));
    });

  return NextResponse.json({
    product: {
      _id: product._id,
      title: product.title,
      slug: product.slug,
      customizationPreview: product.customizationPreview || null,
      customFields: product.customFields || [],
      variants: product.variants || [],
      collageEnabled: product.collageEnabled || false,
      collageTemplates: product.collageTemplates || [],
    },
    variantName,
    sizes,
    options: options.map((o) => ({
      ...o,
      value: `${o.variantName || variantName}: ${o.label}`,
    })),
    source: configuredId && String(product._id) === configuredId ? 'settings' : 'title_fallback',
  });
}
