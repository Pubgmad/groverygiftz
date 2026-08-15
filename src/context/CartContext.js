'use client';
import { createContext, useContext, useState, useEffect } from 'react';

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
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('groverygiftz-cart', JSON.stringify(stripDisplayOnlyPreviewData(cart)));
    } catch {}
  }, [cart]);

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

