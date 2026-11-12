'use client';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useSession } from 'next-auth/react';
import { trackGA4Ecommerce } from '@/lib/ga4';
import { isSameCartLine, mergeGuestCartIntoAccount, stripDisplayOnlyPreviewData } from '@/lib/cartPersist';

const CartContext = createContext();

const normalizeStockLimit = (value) => {
  const limit = Number(value);
  return Number.isFinite(limit) && limit >= 0 ? limit : null;
};

const capQuantity = (quantity, availableStock) => {
  const limit = normalizeStockLimit(availableStock);
  return limit === null ? quantity : Math.min(quantity, limit);
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
    if (Array.isArray(parsed)) return stripDisplayOnlyPreviewData(parsed);
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
  const syncAttemptRef = useRef(0);
  const [syncNonce, setSyncNonce] = useState(0);

  const applyCart = (nextCart) => {
    cartRef.current = nextCart;
    setCart(nextCart);
    return nextCart;
  };

  useEffect(() => {
    let cancelled = false;
    const savedCart = readGuestCart();
    const hydrate = async () => {
      if (!savedCart.length) {
        if (!cancelled) {
          localLoadedRef.current = true;
          setLocalLoaded(true);
        }
        return;
      }
      applyCart(savedCart);
      try {
        const res = await fetch('/api/customization-upload/refresh-display', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cart: stripDisplayOnlyPreviewData(savedCart) }),
        });
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && Array.isArray(data.cart)) applyCart(data.cart);
        }
      } catch {}
      if (!cancelled) {
        localLoadedRef.current = true;
        setLocalLoaded(true);
      }
    };
    hydrate();
    return () => { cancelled = true; };
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
        let merged = mergeGuestCartIntoAccount(data.cart || [], guestCart);
        try {
          const refreshRes = await fetch('/api/customization-upload/refresh-display', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cart: stripDisplayOnlyPreviewData(merged) }),
          });
          if (refreshRes.ok) {
            const refreshed = await refreshRes.json();
            if (Array.isArray(refreshed.cart)) merged = refreshed.cart;
          }
        } catch {}
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
        syncAttemptRef.current = 0;
      })
      .catch(() => {
        activeCustomerRef.current = session.user.id;
        if (syncAttemptRef.current < 3) {
          syncAttemptRef.current += 1;
          window.setTimeout(() => {
            syncingRef.current = false;
            setSyncNonce((value) => value + 1);
          }, 1200 * syncAttemptRef.current);
          return;
        }
        syncedCustomerRef.current = session.user.id;
      })
      .finally(() => {
        if (syncedCustomerRef.current === session.user.id) {
          syncingRef.current = false;
          setCartSyncing(false);
        }
      });
  }, [status, session?.user?.id, session?.user?.type, localLoaded, syncNonce]);

  useEffect(() => {
    const activeCustomerId = status === 'authenticated' && session?.user?.type === 'customer' ? session.user.id : '';
    if (activeCustomerId) {
      activeCustomerRef.current = activeCustomerId;
      return;
    }
    if (status !== 'loading' && activeCustomerRef.current) {
      // Keep the current cart as a guest snapshot so customization images stay visible after logout.
      const snapshot = stripDisplayOnlyPreviewData(cartRef.current || []);
      activeCustomerRef.current = '';
      syncedCustomerRef.current = '';
      syncingRef.current = false;
      if (snapshot.length) {
        persistGuestCart(snapshot);
        applyCart(snapshot);
      } else {
        removeGuestCart();
        applyCart([]);
      }
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
    if (options.flush) flushSync(() => applyCart(nextCart));
    else applyCart(nextCart);
    if (!isAuthenticatedCustomer) persistGuestCart(nextCart);
    else if (options.flush) persistCustomerCart(nextCart);
    const addedLine = nextCart.find((entry) => isSameCartLine(entry, item.productId, item.variant, item.cartItemId));
    const addedQuantity = Number(addedLine?.quantity || 0) - Number(existing?.quantity || 0);
    if (addedQuantity > 0) trackGA4Ecommerce('add_to_cart', [{ ...addedLine, quantity: addedQuantity }]);
    if (options.openDrawer !== false) setIsCartOpen(true);
    return addedQuantity;
  };

  const removeFromCart = (productId, variant, cartItemId) => {
    const removed = (cartRef.current || []).filter((item) => isSameCartLine(item, productId, variant, cartItemId));
    const nextCart = (cartRef.current || []).filter((item) => !isSameCartLine(item, productId, variant, cartItemId));
    applyCart(nextCart);
    if (!isAuthenticatedCustomer) persistGuestCart(nextCart);
    if (removed.length) trackGA4Ecommerce('remove_from_cart', removed);
  };

  const updateQuantity = (productId, variant, quantity, cartItemId) => {
    if (quantity <= 0) return removeFromCart(productId, variant, cartItemId);
    const previous = (cartRef.current || []).filter((item) => isSameCartLine(item, productId, variant, cartItemId));
    const nextCart = (cartRef.current || []).map((item) =>
      isSameCartLine(item, productId, variant, cartItemId) ? { ...item, quantity: capQuantity(quantity, item.availableStock) } : item
    );
    applyCart(nextCart);
    if (!isAuthenticatedCustomer) persistGuestCart(nextCart);
    previous.forEach((item) => {
      const updated = nextCart.find((entry) => isSameCartLine(entry, item.productId, item.variant, cartItemId));
      const difference = Number(updated?.quantity || 0) - Number(item.quantity || 0);
      if (difference) trackGA4Ecommerce(difference > 0 ? 'add_to_cart' : 'remove_from_cart', [{ ...item, quantity: Math.abs(difference) }]);
    });
  };

  const persistCustomerCart = (items) => {
    fetch('/api/customers/saved-lists', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cart: stripDisplayOnlyPreviewData(items || []) }),
      keepalive: true,
    }).catch(() => {});
  };

  const clearCart = () => {
    applyCart([]);
    if (!isAuthenticatedCustomer) {
      persistGuestCart([]);
      return;
    }
    persistCustomerCart([]);
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
