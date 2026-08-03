import ProductCard from '@/components/product/ProductCard';
import Link from 'next/link';

export default function CollectionShowcase({ products, title, subtitle, collectionSlug }) {
  if (!products || products.length === 0) return null;

  return (
    <section className="py-16 md:py-20 px-4 max-w-7xl mx-auto">
      <div className="text-center mb-12">
        {subtitle && collectionSlug && (
          <Link href={`/collections/${collectionSlug}`}
            className="text-accent-600 hover:text-accent-700 font-semibold text-xs uppercase tracking-widest mb-2 inline-block transition-colors">
            {subtitle}
          </Link>
        )}
        {title && <h2 className="section-title">{title}</h2>}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 md:gap-6 lg:grid-cols-4">
        {products.map(product => (
          <ProductCard key={product._id} product={product} />
        ))}
      </div>
      {collectionSlug && (
        <div className="text-center mt-10">
          <Link href={`/collections/${collectionSlug}`} className="btn-outline inline-flex w-full justify-center px-6 sm:w-auto sm:px-10">
            View Full Collection -&gt;
          </Link>
        </div>
      )}
    </section>
  );
}
