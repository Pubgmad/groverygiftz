'use client';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';

const CartContext = createContext();

const isSameCartLine = (cartItem, productId, variant, cartItemId) => {
  if (cartItemId) return cartItem.cartItemId === cartItemId;
  return cartItem.productId === productId && cartItem.variant === variant && !cartItem.cartItemId;
};

const normalizeStockLimit = (value) => {
  const limit = Number(value);
  return Number.isFinite(limit) && limit >= 0 ? limit : null;
};

const capQuantity = (quantity, availableStock) => {
  const limit = normalizeStockLimit(availableStock);
  return limit === null ? quantity : Math.min(quantity, limit);
};
const mergeCartItems = (accountCart = [], localCart = []) => {
  const merged = [...accountCart];
  localCart.forEach((item) => {
    const existingIndex = !item.cartItemId ? merged.findIndex((entry) => isSameCartLine(entry, item.productId, item.variant)) : -1;
    if (existingIndex >= 0) {
      const existing = merged[existingIndex];
      merged[existingIndex] = {
        ...existing,
        quantity: capQuantity(Number(existing.quantity || 0) + Number(item.quantity || 1), existing.availableStock ?? item.availableStock),
      };
      return;
    }
    merged.push({ ...item, quantity: capQuantity(Number(item.quantity || 1), item.availableStock) });
  });
  return merged;
};
const stripDisplayOnlyPreviewData = (value) => {
  if (Array.isArray(value)) return value.map(stripDisplayOnlyPreviewData);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== 'previewUrl' && key !== 'displayUrl')
      .map(([key, entry]) => [key, stripDisplayOnlyPreviewData(entry)])
  );
};

export function CartProvider({ children }) {
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('groverygiftz-cart');
      if (saved) setCart(JSON.parse(saved));
    } catch {
      localStorage.removeItem('groverygiftz-cart');
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
        setCart((current) => {
          const merged = mergeCartItems(data.cart || [], current || []);
          fetch('/api/customers/saved-lists', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cart: stripDisplayOnlyPreviewData(merged) }),
          }).catch(() => {});
          return merged;
        });
        syncedCustomerRef.current = session.user.id;
      })
      .catch(() => {})
      .finally(() => { syncingRef.current = false; });
  }, [status, session?.user?.id, session?.user?.type]);

  useEffect(() => {
    if (!localLoadedRef.current) return;
    try {
      localStorage.setItem('groverygiftz-cart', JSON.stringify(stripDisplayOnlyPreviewData(cart)));
    } catch {}

    if (status !== 'authenticated' || session?.user?.type !== 'customer' || !session.user.id || syncingRef.current || syncedCustomerRef.current !== session.user.id) return;
    const timer = setTimeout(() => {
      fetch('/api/customers/saved-lists', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cart: stripDisplayOnlyPreviewData(cart) }),
      }).catch(() => {});
    }, 350);
    return () => clearTimeout(timer);
  }, [cart, status, session?.user?.id, session?.user?.type]);

  const addToCart = (item, options = {}) => {
    setCart(prev => {
      const existing = !item.cartItemId && prev.find(i => isSameCartLine(i, item.productId, item.variant));
      if (existing) {
        return prev.map(i => isSameCartLine(i, item.productId, item.variant)
          ? { ...i, quantity: capQuantity(i.quantity + item.quantity, item.availableStock ?? i.availableStock) }
          : i
        );
      }
      return [...prev, { ...item, quantity: capQuantity(item.quantity, item.availableStock) }];
    });
    if (options.openDrawer !== false) setIsCartOpen(true);
  };

  const removeFromCart = (productId, variant, cartItemId) => {
    setCart(prev => prev.filter(i => !isSameCartLine(i, productId, variant, cartItemId)));
  };

  const updateQuantity = (productId, variant, quantity, cartItemId) => {
    if (quantity <= 0) return removeFromCart(productId, variant, cartItemId);
    setCart(prev => prev.map(i =>
      isSameCartLine(i, productId, variant, cartItemId) ? { ...i, quantity: capQuantity(quantity, i.availableStock) } : i
    ));
  };

  const clearCart = () => setCart([]);

  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);
  const cartTotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, updateQuantity, clearCart, cartCount, cartTotal, isCartOpen, setIsCartOpen }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);

