'use client';
import Link from 'next/link';
import { FiHeart, FiGift, FiShoppingBag, FiChevronRight, FiClock } from 'react-icons/fi';
import { formatPrice, calcSavings, getDisplayPrice, getDisplayRegularPrice, isOfferActive } from '@/lib/utils';
import { useWishlist } from '@/context/WishlistContext';

function firstProductImage(product, index = 0) {
  const responsive = [
    product?.responsiveImages?.desktop,
    product?.responsiveImages?.tablet,
    product?.responsiveImages?.mobile,
  ].filter(Boolean);
  const images = [...(product?.images || []), ...responsive].filter((url) => typeof url === 'string' && url.trim());
  return images[index] || images[0] || '/placeholder.svg';
}

export default function ProductCard({ product }) {
  const { toggleWishlist, isWishlisted } = useWishlist();
  const wishlisted = isWishlisted(product._id);
  const displayPrice = getDisplayPrice(product);
  const displayRegularPrice = getDisplayRegularPrice(product);
  const savings = displayRegularPrice > displayPrice ? calcSavings(displayRegularPrice, displayPrice) : 0;
  const baseOfferActive = isOfferActive(product);
  const hasVariants = product.variants?.length > 0;
  const hasCustomization = product.customFields?.length > 0;
  const canGiftWrap = product.giftWrap?.enabled || product.giftMessage;
  const isSoldOut = Number(product.stock) <= 0;
  const lowStock = !isSoldOut && Number(product.stock) > 0 && Number(product.stock) <= 10;
  const img1 = firstProductImage(product, 0);
  const img2 = firstProductImage(product, 1);

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group product-card block rounded-2xl border border-white bg-white/95 p-2.5 shadow-sm product-lift transition-all duration-300 hover:-translate-y-1 sm:p-3"
    >
      <div className="relative aspect-[1/1.08] overflow-hidden rounded-xl bg-gray-100 image-sheen sm:aspect-square">
        <div className="absolute left-2 top-2 z-10 flex max-w-[76%] flex-col gap-1.5 sm:left-2.5 sm:top-2.5 sm:max-w-[70%]">
          {savings > 0 && <div className="badge-save w-fit">Save {formatPrice(savings)}</div>}
          {product.isBestSeller && <div className="w-fit rounded-lg bg-accent-500 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm">Best Seller</div>}
          {hasCustomization && (
            <div className="inline-flex w-fit items-center gap-1 rounded-lg bg-white/95 px-2.5 py-1 text-[11px] font-bold text-primary-700 shadow-sm">
              <FiGift size={12} /> Customisable
            </div>
          )}
          {isSoldOut && <div className="w-fit rounded-lg bg-gray-800 px-2.5 py-1 text-xs font-bold text-white">Sold Out</div>}
        </div>

        <button
          onClick={(e) => { e.preventDefault(); toggleWishlist(product); }}
          aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          className={`absolute right-2.5 top-2.5 z-10 flex h-9 w-9 items-center justify-center rounded-full shadow-md transition-all duration-200 hover:scale-110 ${
            wishlisted
              ? 'bg-accent-500 text-white shadow-orange'
              : 'bg-white/95 text-gray-400 hover:text-accent-500 hover:shadow-orange'
          }`}
        >
          <FiHeart size={15} className={wishlisted ? 'fill-white stroke-white' : ''} />
        </button>

        {lowStock && (
          <div className="absolute bottom-12 left-2.5 z-10 rounded-lg bg-amber-500 px-2.5 py-1 text-xs font-bold text-white shadow-sm">
            Only {product.stock} left
          </div>
        )}

        <img src={img1} alt={product.title} onError={(e) => { e.currentTarget.src = '/placeholder.svg'; }} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
        <img src={img2} alt={product.title} onError={(e) => { e.currentTarget.src = '/placeholder.svg'; }} className="product-img-hover absolute inset-0 h-full w-full object-cover" />

        <div className="absolute inset-x-0 bottom-0 translate-y-0 transition-transform duration-300 sm:translate-y-full sm:group-hover:translate-y-0">
          <div className="shop-cta-ribbon flex items-center justify-center gap-1.5 py-2 text-center text-[11px] font-bold tracking-wide text-white sm:gap-2 sm:py-2.5 sm:text-xs">
            <FiShoppingBag size={14} /> View and Buy <FiChevronRight size={14} />
          </div>
        </div>
      </div>

      <div className="px-1 pb-1.5 pt-3.5 sm:px-1.5">
        <h3 className="min-h-[42px] text-[14px] font-semibold leading-snug text-gray-900 line-clamp-2 transition-colors group-hover:text-primary-700 sm:min-h-[40px] sm:text-sm">
          {product.title}
        </h3>

        <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-lg font-extrabold text-primary-700 sm:text-lg">
            {hasVariants ? 'From ' : ''}{formatPrice(displayPrice)}
          </span>
          {savings > 0 && <span className="text-xs font-medium text-gray-400 line-through">{formatPrice(displayRegularPrice)}</span>}
        </div>

        <div className="mt-2 flex min-h-[22px] flex-wrap items-center gap-1.5 text-[11px] font-semibold text-gray-500">
          {canGiftWrap && <span className="rounded-full bg-accent-50 px-2 py-1 text-accent-700">Gift ready</span>}
          {hasVariants && <span className="rounded-full bg-primary-50 px-2 py-1 text-primary-700">Options</span>}
          {product.isQuoteOnly && <span className="rounded-full bg-gray-100 px-2 py-1 text-gray-700">Contact for price</span>}
        </div>

        {baseOfferActive && savings > 0 && product.offerEndsAt && (
          <p className="mt-2 flex items-center gap-1 text-xs font-bold text-accent-600">
            <FiClock size={12} /> Offer ends {new Date(product.offerEndsAt).toLocaleDateString('en-IN')}
          </p>
        )}
        {!product.isQuoteOnly && isSoldOut && <p className="mt-2 text-xs font-medium text-red-500">Currently unavailable</p>}
      </div>
    </Link>
  );
}
