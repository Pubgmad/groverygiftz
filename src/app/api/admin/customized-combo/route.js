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
  const sizes = options.map((o) => o.label);

  return NextResponse.json({
    product: {
      _id: product._id,
      title: product.title,
      slug: product.slug,
    },
    variantName,
    sizes,
    options,
    addedThirteenByTwenty: added,
  });
}
