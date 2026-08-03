'use client';
import { createContext, useContext, useState, useEffect } from 'react';
import { buildProductMetaPayload, trackMetaEvent } from '@/lib/metaPixel';

const WishlistContext = createContext();

export function WishlistProvider({ children }) {
  const [wishlist, setWishlist] = useState([]);

  useEffect(() => {
    const saved = localStorage.getItem('groverygiftz-wishlist');
    if (saved) setWishlist(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem('groverygiftz-wishlist', JSON.stringify(wishlist));
  }, [wishlist]);

  const toggleWishlist = (product) => {
    setWishlist(prev => {
      const exists = prev.find(p => p._id === product._id);
      if (exists) return prev.filter(p => p._id !== product._id);
      return [...prev, {
        _id: product._id,
        title: product.title,
        slug: product.slug,
        images: product.images,
        regularPrice: product.regularPrice,
        salePrice: product.salePrice,
        stock: product.stock,
      }];
    });
  };

  const isWishlisted = (productId) => wishlist.some(p => p._id === productId);
  const wishlistCount = wishlist.length;

  return (
    <WishlistContext.Provider value={{ wishlist, toggleWishlist, isWishlisted, wishlistCount }}>
      {children}
    </WishlistContext.Provider>
  );
}

export const useWishlist = () => useContext(WishlistContext);
