export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Product from '@/models/Product';
import { requireAdminPermission } from '@/lib/adminAccess';
import {
  COMBO_SOURCE_PRODUCT_TITLE_RX,
  ensureThirteenByTwenty,
  extractSizeOptionsFromProduct,
} from '@/lib/customizedCombo';

/**
 * GET: sizes for WhatsApp Customized Combo from the existing Website product variants.
 * Ensures missing 13×20 is present (backward-compatible add).
 */
export async function GET() {
  const { error } = await requireAdminPermission('orders', 'read');
  if (error) return error;
  await dbConnect();

  const product = await Product.findOne({
    title: COMBO_SOURCE_PRODUCT_TITLE_RX,
    isActive: { $ne: false },
  });

  if (!product) {
    return NextResponse.json({
      error: 'Source product not found: Personalized Single Photo Frame, Premium Frame with Matte Finish',
      product: null,
      sizes: [],
    }, { status: 404 });
  }

  const added = ensureThirteenByTwenty(product);
  if (added) {
    product.markModified('variants');
    await product.save();
  }

  const { variantName, options } = extractSizeOptionsFromProduct(product);
  // Prefer natural size sort (e.g. 4x4 … 36x24) while keeping original labels
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
    },
    variantName,
    sizes,
    options,
    addedThirteenByTwenty: added,
  });
}
