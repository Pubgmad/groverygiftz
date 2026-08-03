'use client';
import { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext();

export function CartProvider({ children }) {
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('groverygiftz-cart');
    if (saved) setCart(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem('groverygiftz-cart', JSON.stringify(cart));
  }, [cart]);

  const addToCart = (item, options = {}) => {
    setCart(prev => {
      const existing = prev.find(i => i.productId === item.productId && i.variant === item.variant);
      if (existing) {
        return prev.map(i => i.productId === item.productId && i.variant === item.variant
          ? { ...i, quantity: i.quantity + item.quantity }
          : i
        );
      }
      return [...prev, item];
    });
    if (options.openDrawer !== false) setIsCartOpen(true);
  };

  const removeFromCart = (productId, variant) => {
    setCart(prev => prev.filter(i => !(i.productId === productId && i.variant === variant)));
  };

  const updateQuantity = (productId, variant, quantity) => {
    if (quantity <= 0) return removeFromCart(productId, variant);
    setCart(prev => prev.map(i =>
      i.productId === productId && i.variant === variant ? { ...i, quantity } : i
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

