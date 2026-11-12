export const dynamic = 'force-dynamic';
import dbConnect from '@/lib/db';
import Product from '@/models/Product';
import '@/models/Collection'; // register model for populate('collections')
import ProductDetail from '@/components/product/ProductDetail';
import ProductCard from '@/components/product/ProductCard';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PRODUCT_CARD_SELECT } from '@/lib/productCardFields';
import { presentProductPreview3d, resolvePhotoFrame3dAdminPreviewAccess, isPhotoFrame3dAdminPreviewFlagEnabled } from '@/lib/photoFrame3dAdminPreview';

export default async function ProductPage({ params }) {
  await dbConnect();
  const product = await Product.findOne({ slug: params.slug, isActive: true }).populate('collections').lean();
  if (!product) notFound();

  const related = await Product.find({
    _id: { $ne: product._id },
    isActive: true,
    collections: { $in: product.collections?.map(c => c._id) || [] },
  }).select(PRODUCT_CARD_SELECT).limit(4).lean();

  let previewAccess = { flagEnabled: false, adminPreview: false, cameraAr: false, authorizedAdmin: false };
  if (isPhotoFrame3dAdminPreviewFlagEnabled()) {
    const session = await getServerSession(authOptions);
    previewAccess = await resolvePhotoFrame3dAdminPreviewAccess(session);
  }
  const data = presentProductPreview3d(JSON.parse(JSON.stringify(product)), previewAccess);
  const relatedData = JSON.parse(JSON.stringify(related));

  return (
    <div className="product-mobile-safe mx-auto max-w-7xl overflow-hidden px-3 py-6 sm:px-4 sm:py-8">
      <Breadcrumbs items={[{ label: 'Products', href: '/shop' }, { label: data.title }]} />
      <ProductDetail product={data} />
      {relatedData.length > 0 && (
        <section className="mt-16">
          <h2 className="section-title">You May Also Like</h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4 md:gap-6">
            {relatedData.map((p, index) => <ProductCard key={p._id} product={p} listId="related_products" listName="You May Also Like" listIndex={index} />)}
          </div>
        </section>
      )}
    </div>
  );
}
