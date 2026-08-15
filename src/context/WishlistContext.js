'use client';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';

const WishlistContext = createContext();

const mergeWishlistItems = (accountWishlist = [], localWishlist = []) => {
  const merged = [...accountWishlist];
  localWishlist.forEach((product) => {
    if (!product?._id) return;
    if (!merged.some((entry) => entry?._id === product._id)) merged.push(product);
  });
  return merged;
};

export function WishlistProvider({ children }) {
  const { data: session, status } = useSession();
  const [wishlist, setWishlist] = useState([]);
  const localLoadedRef = useRef(false);
  const syncingRef = useRef(false);
  const syncedCustomerRef = useRef('');
  const activeCustomerRef = useRef('');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('groverygiftz-wishlist');
      if (saved) setWishlist(JSON.parse(saved));
    } catch {
      localStorage.removeItem('groverygiftz-wishlist');
    } finally {
      localLoadedRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (status !== 'authenticated' || session?.user?.type !== 'customer' || !session.user.id || !localLoadedRef.current) return;
    if (syncedCustomerRef.current === session.user.id) return;

    syncingRef.current = true;
    fetch('/api/customers/saved-lists')
      .then((res) => res.ok ? res.json() : Promise.reject())
      .then((data) => {
        setWishlist((current) => {
          const merged = mergeWishlistItems(data.wishlist || [], current || []);
          fetch('/api/customers/saved-lists', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ wishlist: merged }),
          }).catch(() => {});
          return merged;
        });
        syncedCustomerRef.current = session.user.id;
        activeCustomerRef.current = session.user.id;
        localStorage.removeItem('groverygiftz-wishlist');
      })
      .catch(() => {})
      .finally(() => { syncingRef.current = false; });
  }, [status, session?.user?.id, session?.user?.type]);

  useEffect(() => {
    const activeCustomerId = status === 'authenticated' && session?.user?.type === 'customer' ? session.user.id : '';
    if (activeCustomerId) {
      activeCustomerRef.current = activeCustomerId;
      return;
    }
    if (status !== 'loading' && activeCustomerRef.current) {
      activeCustomerRef.current = '';
      syncedCustomerRef.current = '';
      syncingRef.current = false;
      localStorage.removeItem('groverygiftz-wishlist');
      setWishlist([]);
    }
  }, [status, session?.user?.id, session?.user?.type]);

  useEffect(() => {
    if (!localLoadedRef.current) return;
    const isCustomer = status === 'authenticated' && session?.user?.type === 'customer' && session.user.id;
    if (!isCustomer) {
      try {
        localStorage.setItem('groverygiftz-wishlist', JSON.stringify(wishlist));
      } catch {}
      return;
    }

    if (syncingRef.current || syncedCustomerRef.current !== session.user.id) return;
    const timer = setTimeout(() => {
      fetch('/api/customers/saved-lists', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wishlist }),
      }).catch(() => {});
    }, 350);
    return () => clearTimeout(timer);
  }, [wishlist, status, session?.user?.id, session?.user?.type]);

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
        isQuoteOnly: product.isQuoteOnly,
        variants: product.variants,
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
