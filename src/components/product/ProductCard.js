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
  const hasVariants = product.variants?.length > 0;
  const displayedOfferActive = savings > 0 && (!product.offerStartsAt && !product.offerEndsAt
    ? true
    : isOfferActive({ ...product, regularPrice: displayRegularPrice, salePrice: displayPrice }));
  const hasCustomization = product.customFields?.length > 0;
  const canGiftWrap = product.giftWrap?.enabled || product.giftMessage;
  const isSoldOut = Number(product.stock) <= 0;
  const lowStock = !isSoldOut && Number(product.stock) > 0 && Number(product.stock) <= 10;
  const img1 = firstProductImage(product, 0);
  const img2 = firstProductImage(product, 1);

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group product-card flex h-full flex-col rounded-2xl border border-gray-100 bg-white p-2.5 shadow-sm product-lift transition-all duration-300 hover:-translate-y-1 sm:p-3"
    >
      <div className="relative aspect-[1/1.12] overflow-hidden rounded-xl bg-gray-100 image-sheen sm:aspect-square">
        <div className="absolute left-2 top-2 z-10 flex max-w-[74%] flex-col items-start gap-1.5 sm:left-2.5 sm:top-2.5 sm:max-w-[72%]">
          {savings > 0 && <div className="badge-save w-fit">Save {formatPrice(savings)}</div>}
          {product.isBestSeller && <div className="w-fit rounded-md bg-primary-700 px-2.5 py-1 text-[10px] font-extrabold uppercase leading-none text-white shadow-sm sm:text-[11px]">Best Seller</div>}
          {hasCustomization && (
            <div className="inline-flex w-fit items-center gap-1 rounded-md bg-white/95 px-2.5 py-1 text-[10px] font-bold text-primary-700 shadow-sm sm:text-[11px]">
              <FiGift size={12} /> Customisable
            </div>
          )}
          {isSoldOut && <div className="w-fit rounded-md bg-gray-800 px-2.5 py-1 text-[10px] font-bold text-white sm:text-xs">Sold Out</div>}
        </div>

        <button
          onClick={(e) => { e.preventDefault(); toggleWishlist(product); }}
          aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          className={`absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full shadow-md transition-all duration-200 hover:scale-110 sm:right-2.5 sm:top-2.5 sm:h-10 sm:w-10 ${
            wishlisted
              ? 'bg-accent-500 text-white shadow-orange'
              : 'bg-white/95 text-gray-400 hover:text-accent-500 hover:shadow-orange'
          }`}
        >
          <FiHeart size={16} className={wishlisted ? 'fill-white stroke-white' : ''} />
        </button>

        {lowStock && (
          <div className="absolute bottom-2 left-2 z-10 rounded-md bg-amber-500 px-2.5 py-1 text-[10px] font-bold text-white shadow-sm sm:text-xs">
            Only {product.stock} left
          </div>
        )}

        <img src={img1} alt={product.title} onError={(e) => { e.currentTarget.src = '/placeholder.svg'; }} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
        <img src={img2} alt={product.title} onError={(e) => { e.currentTarget.src = '/placeholder.svg'; }} className="product-img-hover absolute inset-0 h-full w-full object-cover" />
      </div>

      <div className="flex flex-1 flex-col px-1 pb-1 pt-3 sm:px-1.5 sm:pt-3.5">
        <h3 className="min-h-[42px] text-[14px] font-extrabold leading-snug text-gray-950 line-clamp-2 transition-colors group-hover:text-primary-700 sm:min-h-[46px] sm:text-base">
          {product.title}
        </h3>

        <div className="mt-2 flex min-h-[30px] flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-lg font-extrabold leading-none text-primary-700 sm:text-xl">
            {hasVariants ? 'From ' : ''}{formatPrice(displayPrice)}
          </span>
          {savings > 0 && <span className="text-xs font-semibold text-gray-400 line-through sm:text-sm">{formatPrice(displayRegularPrice)}</span>}
        </div>

        <div className="mt-2 flex min-h-[28px] flex-wrap items-center gap-1.5 text-[11px] font-semibold text-gray-500">
          {hasVariants && <span className="rounded-full border border-primary-200 bg-white px-3 py-1 text-primary-700">Options</span>}
          {canGiftWrap && <span className="rounded-full bg-accent-50 px-2.5 py-1 text-accent-700">Gift ready</span>}
          {product.isQuoteOnly && <span className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-700">Contact for price</span>}
        </div>

        <div className="mt-1 min-h-[24px]">
          {displayedOfferActive && product.offerEndsAt && (
            <p className="flex items-center gap-1 text-[11px] font-bold text-accent-700 sm:text-xs">
              <FiClock size={12} /> Offer ends {new Date(product.offerEndsAt).toLocaleDateString('en-IN')}
            </p>
          )}
          {!product.isQuoteOnly && isSoldOut && <p className="text-xs font-medium text-red-500">Currently unavailable</p>}
        </div>

        <div className="shop-cta-ribbon mt-auto flex h-11 items-center justify-center gap-2 rounded-lg px-3 text-center text-sm font-extrabold text-white shadow-orange transition-transform duration-200 group-hover:scale-[1.01] sm:h-12 sm:text-base">
          <FiShoppingBag size={17} />
          <span>View and Buy</span>
          <FiChevronRight size={18} />
        </div>
      </div>
    </Link>
  );
}
