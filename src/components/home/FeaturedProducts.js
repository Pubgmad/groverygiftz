import ProductCard from '@/components/product/ProductCard';
import Link from 'next/link';
import { FiArrowRight, FiShoppingBag, FiStar } from 'react-icons/fi';

function previewImage(product) {
  return product?.responsiveImages?.desktop?.[0]
    || product?.responsiveImages?.tablet?.[0]
    || product?.responsiveImages?.mobile?.[0]
    || product?.images?.[0]
    || '';
}

function pickPreviewProducts(products = []) {
  return [...products]
    .filter((product) => previewImage(product))
    .sort(() => Math.random() - 0.5)
    .slice(0, 4);
}

export default function FeaturedProducts({ products, eyebrow, title, subtitle, buttonText, buttonLink = '/shop' }) {
  if (!products || products.length === 0) return null;

  const previewProducts = pickPreviewProducts(products);

  return (
    <section className="relative overflow-hidden bg-white py-16 md:py-20">
      <div className="absolute inset-x-0 top-0 h-28 gift-paper-band opacity-70" />
      <div className="relative z-10 mx-auto max-w-7xl px-4">
        <div className="relative mb-10 overflow-hidden rounded-3xl border border-primary-100 bg-white px-5 py-6 shadow-brand md:mb-12 md:px-8 md:py-7">
          {previewProducts.length > 0 && (
            <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[46%] items-center justify-end gap-3 pr-5 opacity-20 md:flex lg:opacity-25">
              {previewProducts.map((product, idx) => (
                <div key={product._id || idx} className="h-24 w-20 overflow-hidden rounded-xl bg-gray-100 shadow-md lg:h-28 lg:w-24" style={{ transform: `translateY(${idx % 2 ? 12 : -10}px)` }}>
                  <img src={previewImage(product)} alt="" className="h-full w-full object-cover" />
                </div>
              ))}
              <div className="absolute inset-0 bg-gradient-to-r from-white via-white/80 to-white/20" />
            </div>
          )}
          {previewProducts.length > 0 && (
            <div className="pointer-events-none absolute inset-x-4 bottom-0 flex translate-y-1/2 justify-end gap-2 opacity-15 md:hidden">
              {previewProducts.map((product, idx) => (
                <div key={product._id || idx} className="h-14 w-14 overflow-hidden rounded-lg bg-gray-100 shadow-sm">
                  <img src={previewImage(product)} alt="" className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          )}
          <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
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