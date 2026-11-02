'use client';
import { useEffect, useMemo, useRef } from 'react';
import { isGA4TrackingAllowed, trackGA4Ecommerce } from '@/lib/ga4';
import { GOOGLE_CONSENT_SYNC_EVENT } from '@/lib/googleConsent';
import { useCart } from '@/context/CartContext';
import { FiX, FiPlus, FiMinus, FiTrash2, FiShoppingBag, FiTruck, FiGift } from 'react-icons/fi';
import Link from 'next/link';
import { formatPrice } from '@/lib/utils';
import { calculateCartShipping } from '@/lib/shipping';
import { buildCurrentDeliveryEstimate } from '@/lib/centralDeliveryEstimates';
import useDeliverySettings from '@/hooks/useDeliverySettings';
import ConfiguredImageSections from '@/components/cart/ConfiguredImageSections';

export default function CartDrawer() {
  const { cart, isCartOpen, setIsCartOpen, removeFromCart, updateQuantity, cartTotal, cartCount, cartReady } = useCart();
  const ga4ViewedRef = useRef(false);
  useEffect(() => {
    if (!isCartOpen) { ga4ViewedRef.current = false; return; }
    const track = () => {
      if (!isGA4TrackingAllowed()) { ga4ViewedRef.current = false; return; }
      if (cartReady && !ga4ViewedRef.current) ga4ViewedRef.current = trackGA4Ecommerce('view_cart', cart);
    };
    track();
    window.addEventListener(GOOGLE_CONSENT_SYNC_EVENT, track);
    return () => window.removeEventListener(GOOGLE_CONSENT_SYNC_EVENT, track);
  }, [isCartOpen, cartReady, cart]);
  const settings = useDeliverySettings();
  const selectedState = cart.find((item) => item.deliveryState)?.deliveryState || (typeof window !== 'undefined' ? window.localStorage?.getItem('groveryDeliveryState') : '') || '';
  const shippingSummary = useMemo(() => calculateCartShipping(cart, selectedState, settings), [cart, selectedState, settings]);
  const checkoutTotal = cartTotal + (selectedState ? shippingSummary.cost : 0);

  if (!isCartOpen) return null;

  return (
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsCartOpen(false)} />
      <div className="absolute right-0 top-0 flex h-[100dvh] max-h-[100dvh] w-full max-w-md min-h-0 flex-col overflow-hidden bg-white shadow-2xl">
        <div className="h-1 shrink-0 bg-gradient-to-r from-primary-600 via-accent-500 to-primary-600" />
        <div className="flex shrink-0 items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-2"><FiShoppingBag size={20} className="text-primary-600" /><h2 className="text-xl font-display font-bold">My Cart</h2>{cartCount > 0 && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-500 text-xs font-bold text-white">{cartCount}</span>}</div>
          <button onClick={() => setIsCartOpen(false)} className="rounded-full p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"><FiX size={22} /></button>
        </div>

        {cart.length > 0 && (
          <div className="flex shrink-0 gap-2 border-b bg-primary-50/60 px-6 py-3 text-sm text-gray-700">
            <FiTruck size={15} className="mt-0.5 shrink-0 text-primary-600" />
            <span>Delivery charges are added from the selected state at checkout.</span>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4">
          {cart.length === 0 ? (
            <div className="text-center py-16">
              <FiShoppingBag size={56} className="mx-auto mb-4 text-primary-200" />
              <p className="text-gray-700 font-semibold text-lg mb-1">Your cart is empty</p>
              <p className="text-gray-400 text-sm mb-6">Add items to get started</p>
              <button onClick={() => setIsCartOpen(false)} className="btn-primary px-8">Explore Gifts</button>
            </div>
          ) : (
            <div className="space-y-3">
              {cart.map((item, idx) => (
                <div key={idx} className="flex max-w-full gap-3 overflow-hidden rounded-xl border border-gray-100 bg-gray-50 p-3">
                  {item.image ? <img src={item.image} alt={item.title} className="h-20 w-20 flex-shrink-0 rounded-lg object-cover shadow-sm" /> : <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-600"><FiGift size={24} /></div>}
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <h4 className="line-clamp-2 text-sm font-semibold leading-snug">{item.title}</h4>
                    {item.variant && <p className="mt-0.5 text-xs text-gray-500">{item.variant}</p>}
                    {item.giftWrap && <p className="mt-0.5 text-xs text-primary-600">Gift wrapped</p>}
                    {item.deliveryState && <p className="mt-0.5 text-xs text-gray-500">State: {item.deliveryState}</p>}
                    <ConfiguredImageSections item={item} compact includeProductImages={false} />
                    <p className="mt-1 font-bold text-primary-600">{formatPrice(item.price * item.quantity)}</p>
                    <div className="mt-2 flex min-w-0 items-center gap-2">
                      <div className="flex items-center overflow-hidden rounded-lg border border-gray-200"><button onClick={() => updateQuantity(item.productId, item.variant, item.quantity - 1, item.cartItemId)} className="flex h-7 w-7 items-center justify-center text-gray-600 transition-colors hover:bg-gray-200"><FiMinus size={12} /></button><span className="w-8 text-center text-sm font-semibold">{item.quantity}</span><button onClick={() => updateQuantity(item.productId, item.variant, item.quantity + 1, item.cartItemId)} className="flex h-7 w-7 items-center justify-center text-gray-600 transition-colors hover:bg-gray-200"><FiPlus size={12} /></button></div>
                      <button onClick={() => removeFromCart(item.productId, item.variant, item.cartItemId)} className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg text-red-400 transition-colors hover:bg-red-50 hover:text-red-600"><FiTrash2 size={14} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {cart.length > 0 && (
          <div className="shrink-0 space-y-3 border-t bg-white px-6 pt-4" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between"><span className="font-medium text-gray-600">Subtotal</span><span className="text-lg font-bold text-gray-900">{formatPrice(cartTotal)}</span></div>
              {selectedState && <div className="flex items-center justify-between text-sm"><span className="text-gray-600">Delivery charge</span><span className="font-bold text-gray-900">{shippingSummary.cost === 0 ? 'FREE' : formatPrice(shippingSummary.cost)}</span></div>}
              {selectedState && <div className="flex items-center justify-between border-t pt-2"><span className="font-bold text-gray-900">Checkout total</span><span className="text-xl font-bold text-primary-700">{formatPrice(checkoutTotal)}</span></div>}
              {!selectedState && <div className="rounded-lg bg-primary-50 px-3 py-2 text-xs text-gray-600">Select state on product or checkout page to see delivery charge.</div>}
              <p className="line-clamp-2 text-xs text-gray-600">Estimated delivery: {buildCurrentDeliveryEstimate(settings, selectedState)}</p>
            </div>
            <Link href="/checkout" onClick={() => setIsCartOpen(false)} className="btn-accent flex w-full items-center justify-center gap-2 py-3.5 text-center text-base font-bold">Checkout Now</Link>
            <div className="flex items-center justify-between gap-3 pb-1 text-sm">
              <Link href="/cart" onClick={() => setIsCartOpen(false)} className="font-semibold text-primary-600 hover:text-primary-700">View cart</Link>
              <button onClick={() => setIsCartOpen(false)} className="text-gray-500 hover:text-primary-600">Continue Shopping</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
