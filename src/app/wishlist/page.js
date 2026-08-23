'use client';
import { useWishlist } from '@/context/WishlistContext';
import { formatPrice, calcSavings } from '@/lib/utils';
import Link from 'next/link';
import { FiHeart, FiShoppingBag } from 'react-icons/fi';

export default function WishlistPage() {
  const { wishlist, toggleWishlist } = useWishlist();

  if (wishlist.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 sm:py-24 text-center">
        <div className="text-6xl sm:text-8xl mb-5 sm:mb-6">Wishlist</div>
        <h1 className="text-3xl font-display font-bold mb-3">Your Wishlist is Empty</h1>
        <p className="text-gray-500 mb-8">Save your favorite gifts here and come back to them anytime.</p>
        <Link href="/shop" className="btn-accent inline-flex w-full justify-center px-6 py-3.5 sm:w-auto sm:px-10">Explore Gifts</Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <FiHeart size={26} className="text-accent-500 fill-accent-500" />
        <h1 className="text-3xl font-display font-bold">My Wishlist</h1>
        <span className="bg-accent-500 text-white text-sm font-bold px-2.5 py-0.5 rounded-full">{wishlist.length}</span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 md:gap-6 lg:grid-cols-4">
        {wishlist.map(product => {
          const savings = product.salePrice ? calcSavings(product.regularPrice, product.salePrice) : 0;
          const displayPrice = product.salePrice || product.regularPrice;
          const img = product.images?.[0] || '/placeholder.svg';
          const isSoldOut = Number(product.stock) <= 0;

          return (
            <div key={product._id} className="group bg-white rounded-2xl border overflow-hidden card-hover">
              <div className="relative aspect-square overflow-hidden bg-gray-100">
                {savings > 0 && (
                  <div className="absolute top-2.5 left-2.5 z-10 badge-save">Save {formatPrice(savings)}</div>
                )}
                <button
                  onClick={() => toggleWishlist(product)}
                  className="absolute top-2.5 right-2.5 z-10 w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center hover:scale-110 transition-transform"
                  title="Remove from wishlist"
                >
                  <FiHeart size={16} className="text-accent-500 fill-accent-500" />
                </button>
                <Link href={`/products/${product.slug}`}>
                  <img src={img} alt={product.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                </Link>
              </div>
              <div className="p-3">
                <Link href={`/products/${product.slug}`}>
                  <h3 className="text-sm font-medium text-gray-800 line-clamp-2 hover:text-primary-600 transition-colors mb-2">
                    {product.title}
                  </h3>
                </Link>
                <div className="flex items-center gap-2 mb-3">
                  <span className="font-bold text-primary-700">{formatPrice(displayPrice)}</span>
                  {savings > 0 && <span className="text-xs text-gray-400 line-through">{formatPrice(product.regularPrice)}</span>}
                </div>
                <Link href={`/products/${product.slug}`}
                  className="flex items-center justify-center gap-1.5 w-full bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold py-2 rounded-xl transition-colors">
                  <FiShoppingBag size={14} />
                  {isSoldOut ? 'Sold Out' : 'View & Add to Cart'}
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
