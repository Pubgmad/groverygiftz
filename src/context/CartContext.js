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
      .filter(([key]) => key !== 'previewUrl')
      .map(([key, entry]) => [key, stripDisplayOnlyPreviewData(entry)])
  );
};

export function CartProvider({ children }) {
  const { data: session, status } = useSession();
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const localLoadedRef = useRef(false);
  const syncingRef = useRef(false);
  const [localLoaded, setLocalLoaded] = useState(false);
  const [cartSyncing, setCartSyncing] = useState(false);
  const syncedCustomerRef = useRef('');
  const activeCustomerRef = useRef('');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('groverygiftz-cart');
      if (saved) setCart(JSON.parse(saved));
    } catch {
      localStorage.removeItem('groverygiftz-cart');
    } finally {
      localLoadedRef.current = true;
      setLocalLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (status !== 'authenticated' || session?.user?.type !== 'customer' || !session.user.id || !localLoaded) return;
    if (syncedCustomerRef.current === session.user.id) return;

    syncingRef.current = true;
    setCartSyncing(true);
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
        activeCustomerRef.current = session.user.id;
        localStorage.removeItem('groverygiftz-cart');
      })
      .catch(() => {
        syncedCustomerRef.current = session.user.id;
        activeCustomerRef.current = session.user.id;
      })
      .finally(() => { syncingRef.current = false; setCartSyncing(false); });
  }, [status, session?.user?.id, session?.user?.type, localLoaded]);

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
      localStorage.removeItem('groverygiftz-cart');
      setCart([]);
    }
  }, [status, session?.user?.id, session?.user?.type]);

  useEffect(() => {
    if (!localLoadedRef.current) return;
    const isCustomer = status === 'authenticated' && session?.user?.type === 'customer' && session.user.id;
    if (!isCustomer) {
      try {
        localStorage.setItem('groverygiftz-cart', JSON.stringify(stripDisplayOnlyPreviewData(cart)));
      } catch {}
      return;
    }

    if (syncingRef.current || syncedCustomerRef.current !== session.user.id) return;
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
  const currentCustomerId = status === 'authenticated' && session?.user?.type === 'customer' ? session.user.id : '';
  const cartReady = localLoaded && (!currentCustomerId || (syncedCustomerRef.current === currentCustomerId && !cartSyncing));

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, updateQuantity, clearCart, cartCount, cartTotal, cartReady, cartSyncing, isCartOpen, setIsCartOpen }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);

