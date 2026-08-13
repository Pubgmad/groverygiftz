'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { formatPrice, calcSavings, getDisplayPrice, getDisplayRegularPrice, getVariantEffectivePrice, getVariantRegularPrice, isOfferActive } from '@/lib/utils';
import { FiShoppingCart, FiZap, FiStar, FiTruck, FiShield, FiGift, FiPlus, FiMinus } from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function ProductSpotlight({ product }) {
  const { addToCart } = useCart();
  const [qty, setQty] = useState(1);
  const [selectedVariants, setSelectedVariants] = useState({});

  if (!product) return null;

  const selectedOwnPriceOption = Object.values(selectedVariants).find((v) => v?.useOwnPrice && getVariantRegularPrice(v) > 0);
  const displayRegularPrice = selectedOwnPriceOption ? getVariantRegularPrice(selectedOwnPriceOption) : getDisplayRegularPrice(product);
  const displayPrice = selectedOwnPriceOption ? getVariantEffectivePrice(selectedOwnPriceOption, product) : getDisplayPrice(product);
  const offerActive = displayPrice < displayRegularPrice && (!product.offerStartsAt && !product.offerEndsAt
    ? true
    : isOfferActive({ ...product, regularPrice: displayRegularPrice, salePrice: displayPrice }));
  const savings = offerActive ? calcSavings(displayRegularPrice, displayPrice) : 0;
  const isSoldOut = Number(product.stock) <= 0;
  const hasCustomization = product.customFields?.length > 0;

  const getSelectedExtra = () => Object.values(selectedVariants).reduce((s, v) => s + (!v?.useOwnPrice ? (v?.extra || 0) : 0), 0);
  const finalPrice = displayPrice + getSelectedExtra();

  const handleAdd = () => {
    if (isSoldOut) return toast.error('This product is sold out');
    const variantStr = Object.entries(selectedVariants).map(([k, v]) => `${k}: ${v.label}`).join(', ');
    addToCart({
      productId: product._id,
      title: product.title,
      image: product.images?.[0] || '',
      price: finalPrice,
      quantity: qty,
      variant: variantStr,
    });
    toast.success('Added to cart!');
  };

  return (
    <section className="bg-primary-900 py-16 text-white md:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-10 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="section-eyebrow text-accent-300"><FiStar size={14} /> Spotlight gift</p>
            <h2 className="text-3xl font-display font-extrabold md:text-5xl">A gift worth noticing</h2>
          </div>
          <Link href="/shop" className="inline-flex w-fit items-center gap-2 rounded-xl border border-white/25 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-white hover:text-primary-800">
            Browse all gifts <FiZap size={16} />
          </Link>
        </div>

        <div className="grid overflow-hidden rounded-2xl bg-white text-gray-900 shadow-2xl sm:rounded-3xl md:grid-cols-2">
          <Link href={`/products/${product.slug}`} className="group relative block overflow-hidden bg-white">
            {product.images?.[0] ? (
              <img src={product.images[0]} alt={product.title} className="mx-auto block h-auto max-h-[78vh] max-w-full object-contain transition-transform duration-700 group-hover:scale-105" />
            ) : (
              <div className="flex min-h-[360px] w-full items-center justify-center bg-gradient-to-br from-primary-100 to-accent-100 text-primary-700 md:min-h-[560px]">
                <FiGift size={72} />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/72 via-transparent to-transparent" />
            <div className="absolute bottom-5 left-5 right-5 flex flex-wrap gap-2">
              {savings > 0 && <span className="badge-save text-sm">Save {formatPrice(savings)}</span>}
              {hasCustomization && <span className="rounded-lg bg-white px-3 py-1 text-sm font-bold text-primary-700 shadow-sm">Personalised</span>}
              {isSoldOut && <span className="rounded-lg bg-gray-800 px-3 py-1 text-sm font-bold text-white">Sold Out</span>}
            </div>
          </Link>

          <div className="flex flex-col justify-center gap-5 px-6 py-8 md:px-10 md:py-12">
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-accent-50 px-3 py-1 text-xs font-bold text-accent-700">
              <FiStar size={12} className="fill-accent-500 stroke-accent-500" /> Featured pick
            </span>

            <Link href={`/products/${product.slug}`}>
              <h3 className="text-2xl font-display font-extrabold leading-tight text-gray-950 transition-colors hover:text-primary-700 md:text-4xl">
                {product.title}
              </h3>
            </Link>

            {product.shortDescription && <p className="text-sm leading-7 text-gray-600 line-clamp-3 md:text-base">{product.shortDescription}</p>}

            <div className="grid grid-cols-1 gap-2 text-center text-xs font-bold text-gray-600 sm:grid-cols-3">
              <div className="rounded-xl bg-primary-50 px-2 py-3"><FiTruck className="mx-auto mb-1 text-primary-700" /> Delivery ready</div>
              <div className="rounded-xl bg-accent-50 px-2 py-3"><FiGift className="mx-auto mb-1 text-accent-700" /> Premium quality</div>
              <div className="rounded-xl bg-emerald-50 px-2 py-3"><FiShield className="mx-auto mb-1 text-emerald-700" /> Secure order</div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span className="text-3xl font-extrabold text-primary-700">{formatPrice(finalPrice)}</span>
              {savings > 0 && <span className="text-lg text-gray-400 line-through">{formatPrice(displayRegularPrice)}</span>}
              {offerActive && product.offerEndsAt && <span className="text-sm font-bold text-accent-600">Ends {new Date(product.offerEndsAt).toLocaleDateString('en-IN')}</span>}
            </div>

            {product.variants?.map((variant, vIdx) => (
              <div key={vIdx}>
                <label className="mb-2 block text-sm font-bold">{variant.name}</label>
                <div className="flex flex-wrap gap-2">
                  {variant.options?.map((opt, oIdx) => {
                    const extra = Number(opt?.priceAdjustment ?? opt?.price ?? 0);
                    const selected = selectedVariants[variant.name]?.label === opt.label;
                    const optionRegularPrice = getVariantRegularPrice(opt);
                    const optionPrice = getVariantEffectivePrice(opt, product);
                    const optionUsesOwnPrice = !!opt.useOwnPrice && optionRegularPrice > 0;
                    const optionLabel = optionUsesOwnPrice ? `${opt.label} (${formatPrice(optionPrice)})` : `${opt.label}${extra > 0 ? ` (+${formatPrice(extra)})` : ''}`;
                    return (
                      <button
                        key={oIdx}
                        type="button"
                        onClick={() => setSelectedVariants((prev) => ({ ...prev, [variant.name]: { label: opt.label, extra, useOwnPrice: optionUsesOwnPrice, regularPrice: opt.regularPrice, salePrice: opt.salePrice } }))}
                        className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors ${selected ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-gray-300 hover:border-gray-500'}`}
                      >
                        {optionLabel}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center overflow-hidden rounded-xl border-2 border-gray-200">
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="flex h-11 w-11 items-center justify-center text-gray-600 transition-colors hover:bg-gray-100" aria-label="Decrease quantity"><FiMinus size={16} /></button>
                <span className="w-11 text-center font-extrabold">{qty}</span>
                <button onClick={() => setQty((q) => q + 1)} className="flex h-11 w-11 items-center justify-center text-gray-600 transition-colors hover:bg-gray-100" aria-label="Increase quantity"><FiPlus size={16} /></button>
              </div>
              {!isSoldOut && product.stock > 0 && product.stock < 50 && <span className="text-xs font-bold text-accent-600">Only {product.stock} left</span>}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button onClick={handleAdd} disabled={isSoldOut} className={`btn-primary flex flex-1 items-center justify-center gap-2 ${isSoldOut ? 'cursor-not-allowed opacity-60' : ''}`}>
                <FiShoppingCart size={17} /> {isSoldOut ? 'Sold Out' : 'Add to Cart'}
              </button>
              <Link href={`/products/${product.slug}`} className="btn-outline flex flex-1 items-center justify-center gap-2 text-center">
                <FiZap size={17} /> Personalise / View
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}


