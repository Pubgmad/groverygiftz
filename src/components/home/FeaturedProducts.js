import ProductCard from '@/components/product/ProductCard';
import Link from 'next/link';
import { FiArrowRight, FiShoppingBag, FiStar } from 'react-icons/fi';

export default function FeaturedProducts({ products, eyebrow, title, subtitle, buttonText, buttonLink = '/shop' }) {
  if (!products || products.length === 0) return null;

  return (
    <section className="relative overflow-hidden bg-white py-16 md:py-20">
      <div className="absolute inset-x-0 top-0 h-28 gift-paper-band opacity-70" />
      <div className="relative z-10 mx-auto max-w-7xl px-4">
        <div className="mb-10 rounded-3xl border border-primary-100 bg-white px-5 py-6 shadow-brand md:mb-12 md:px-8 md:py-7">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              {eyebrow && (
                <p className="section-eyebrow">
                  <FiStar size={14} className="text-accent-500" /> {eyebrow}
                </p>
              )}
              {title && <h2 className="text-3xl font-display font-extrabold leading-tight text-gray-950 md:text-5xl">{title}</h2>}
              {subtitle && <p className="mt-4 max-w-xl text-gray-600">{subtitle}</p>}
            </div>
            <Link href={buttonLink} className="btn-accent inline-flex w-fit items-center gap-2 px-6 py-3.5">
              <FiShoppingBag size={17} />
              <span>{buttonText || 'Explore Products'}</span>
              <FiArrowRight size={16} />
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 md:gap-6 lg:grid-cols-4">
          {products.map(product => <ProductCard key={product._id} product={product} />)}
        </div>
      </div>
    </section>
  );
}

