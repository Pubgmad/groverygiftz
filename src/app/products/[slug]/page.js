export const dynamic = 'force-dynamic';
import dbConnect from '@/lib/db';
import Product from '@/models/Product';
import Collection from '@/models/Collection';
import ProductDetail from '@/components/product/ProductDetail';
import ProductCard from '@/components/product/ProductCard';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import { notFound } from 'next/navigation';

export default async function ProductPage({ params }) {
  await dbConnect();
  const product = await Product.findOne({ slug: params.slug, isActive: true }).populate('collections').lean();
  if (!product) notFound();

  const related = await Product.find({
    _id: { $ne: product._id },
    isActive: true,
    collections: { $in: product.collections?.map(c => c._id) || [] },
  }).limit(4).lean();

  const data = JSON.parse(JSON.stringify(product));
  const relatedData = JSON.parse(JSON.stringify(related));

  return (
    <div className="product-mobile-safe mx-auto max-w-7xl overflow-hidden px-3 py-6 sm:px-4 sm:py-8">
      <Breadcrumbs items={[{ label: 'Products', href: '/shop' }, { label: data.title }]} />
      <ProductDetail product={data} />
      {relatedData.length > 0 && (
        <section className="mt-16">
          <h2 className="section-title">You May Also Like</h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4 md:gap-6">
            {relatedData.map(p => <ProductCard key={p._id} product={p} />)}
          </div>
        </section>
      )}
    </div>
  );
}
