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

const persistGuestCart = (items) => {
  try {
    localStorage.setItem('groverygiftz-cart', JSON.stringify(stripDisplayOnlyPreviewData(items || [])));
  } catch {}
};

const removeGuestCart = () => {
  try {
    localStorage.removeItem('groverygiftz-cart');
  } catch {}
};

const readGuestCart = () => {
  try {
    const saved = localStorage.getItem('groverygiftz-cart');
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed)) return parsed;
    removeGuestCart();
  } catch {
    removeGuestCart();
  }
  return [];
};

export function CartProvider({ children }) {
  const { data: session, status } = useSession();
  const [cart, setCart] = useState([]);
  const cartRef = useRef([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const localLoadedRef = useRef(false);
  const syncingRef = useRef(false);
  const [localLoaded, setLocalLoaded] = useState(false);
  const [cartSyncing, setCartSyncing] = useState(false);
  const syncedCustomerRef = useRef('');
  const activeCustomerRef = useRef('');

  const applyCart = (nextCart) => {
    cartRef.current = nextCart;
    setCart(nextCart);
    return nextCart;
  };

  useEffect(() => {
    const savedCart = readGuestCart();
    if (savedCart.length) applyCart(savedCart);
    localLoadedRef.current = true;
    setLocalLoaded(true);
  }, []);

  useEffect(() => {
    if (status !== 'authenticated' || session?.user?.type !== 'customer' || !session.user.id || !localLoaded) return;
    if (syncedCustomerRef.current === session.user.id || syncingRef.current) return;

    syncingRef.current = true;
    setCartSyncing(true);
    fetch('/api/customers/saved-lists')
      .then((res) => res.ok ? res.json() : Promise.reject())
      .then(async (data) => {
        const guestCart = cartRef.current || [];
        const merged = mergeCartItems(data.cart || [], guestCart);
        applyCart(merged);
        try {
          const saveRes = await fetch('/api/customers/saved-lists', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cart: stripDisplayOnlyPreviewData(merged) }),
          });
          if (saveRes.ok) removeGuestCart();
        } catch {}
        syncedCustomerRef.current = session.user.id;
        activeCustomerRef.current = session.user.id;
      })
      .catch(() => {
        syncedCustomerRef.current = session.user.id;
        activeCustomerRef.current = session.user.id;
      })
      .finally(() => {
        syncingRef.current = false;
        setCartSyncing(false);
      });
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
      removeGuestCart();
      applyCart([]);
    }
  }, [status, session?.user?.id, session?.user?.type]);

  useEffect(() => {
    if (!localLoadedRef.current) return;
    const isCustomer = status === 'authenticated' && session?.user?.type === 'customer' && session.user.id;
    if (!isCustomer) {
      persistGuestCart(cartRef.current);
      return;
    }

    if (syncingRef.current || syncedCustomerRef.current !== session.user.id) return;
    const timer = setTimeout(() => {
      fetch('/api/customers/saved-lists', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cart: stripDisplayOnlyPreviewData(cartRef.current) }),
      }).catch(() => {});
    }, 350);
    return () => clearTimeout(timer);
  }, [cart, status, session?.user?.id, session?.user?.type]);

  const isAuthenticatedCustomer = status === 'authenticated' && session?.user?.type === 'customer' && session.user.id;

  const addToCart = (item, options = {}) => {
    const prev = cartRef.current || [];
    const existing = !item.cartItemId && prev.find((entry) => isSameCartLine(entry, item.productId, item.variant));
    let nextCart;
    if (existing) {
      nextCart = prev.map((entry) => isSameCartLine(entry, item.productId, item.variant)
        ? { ...entry, quantity: capQuantity(entry.quantity + item.quantity, item.availableStock ?? entry.availableStock) }
        : entry
      );
    } else {
      nextCart = [...prev, { ...item, quantity: capQuantity(item.quantity, item.availableStock) }];
    }
    applyCart(nextCart);
    if (!isAuthenticatedCustomer) persistGuestCart(nextCart);
    if (options.openDrawer !== false) setIsCartOpen(true);
  };

  const removeFromCart = (productId, variant, cartItemId) => {
    const nextCart = (cartRef.current || []).filter((item) => !isSameCartLine(item, productId, variant, cartItemId));
    applyCart(nextCart);
    if (!isAuthenticatedCustomer) persistGuestCart(nextCart);
  };

  const updateQuantity = (productId, variant, quantity, cartItemId) => {
    if (quantity <= 0) return removeFromCart(productId, variant, cartItemId);
    const nextCart = (cartRef.current || []).map((item) =>
      isSameCartLine(item, productId, variant, cartItemId) ? { ...item, quantity: capQuantity(quantity, item.availableStock) } : item
    );
    applyCart(nextCart);
    if (!isAuthenticatedCustomer) persistGuestCart(nextCart);
  };

  const clearCart = () => {
    applyCart([]);
    if (!isAuthenticatedCustomer) persistGuestCart([]);
  };

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const currentCustomerId = status === 'authenticated' && session?.user?.type === 'customer' ? session.user.id : '';
  const cartReady = localLoaded && (!currentCustomerId || (syncedCustomerRef.current === currentCustomerId && !cartSyncing));

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, updateQuantity, clearCart, cartCount, cartTotal, cartReady, cartSyncing, isCartOpen, setIsCartOpen }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
