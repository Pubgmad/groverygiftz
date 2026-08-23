'use client';
import { useCart } from '@/context/CartContext';
import { formatPrice } from '@/lib/utils';
import { FiMinus, FiPlus, FiTrash2, FiTruck, FiShoppingBag, FiGift } from 'react-icons/fi';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ConfiguredImageSections from '@/components/cart/ConfiguredImageSections';

export default function CartPage() {
  const { cart, removeFromCart, updateQuantity, cartTotal, cartReady } = useCart();
  const router = useRouter();

  if (!cartReady) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 sm:py-24 text-center">
        <FiShoppingBag size={72} className="mx-auto mb-6 text-primary-200" />
        <h1 className="text-3xl font-display font-bold mb-3">Restoring your cart...</h1>
        <p className="text-gray-500">Please wait while your saved cart is loaded.</p>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 sm:py-24 text-center">
        <FiShoppingBag size={72} className="mx-auto mb-6 text-primary-200" />
        <h1 className="text-3xl font-display font-bold mb-3">Your Cart is Empty</h1>
        <p className="text-gray-500 mb-8">Browse our collections and find a gift that speaks from the heart.</p>
        <Link href="/shop" className="btn-accent inline-flex w-full justify-center px-6 py-3.5 sm:w-auto sm:px-10">Start Shopping</Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl md:text-3xl font-display font-bold mb-8 flex items-center gap-3">
        <FiShoppingBag className="text-primary-600" /> Shopping Cart
        <span className="text-base font-normal text-gray-400">({cart.length} item{cart.length > 1 ? 's' : ''})</span>
      </h1>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          {cart.map((item, idx) => (
            <div key={idx} className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-4 p-4 sm:flex-row">
              {item.image ? <img src={item.image} alt={item.title} className="h-24 w-24 flex-shrink-0 rounded-xl bg-white object-contain" /> : <div className="w-24 h-24 rounded-xl bg-primary-50 flex items-center justify-center text-primary-600 flex-shrink-0"><FiGift size={30} /></div>}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm leading-snug line-clamp-2 mb-0.5">{item.title}</h3>
                {item.variant && <p className="text-xs text-gray-400 mb-1">{item.variant}</p>}
                {item.giftWrap && <p className="text-xs text-primary-600 mb-1">Gift wrapped</p>}
                {item.deliveryState && <p className="text-xs text-gray-500 mb-1">State: {item.deliveryState}</p>}
                <ConfiguredImageSections item={item} />
                <p className="font-bold text-primary-600">{formatPrice(item.price)}</p>
              </div>
              <div className="flex flex-row items-center justify-between gap-2 sm:flex-col sm:items-end">
                <p className="font-bold text-gray-800 whitespace-nowrap">{formatPrice(item.price * item.quantity)}</p>
                <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                  <button type="button" onClick={() => updateQuantity(item.productId, item.variant, item.quantity - 1, item.cartItemId)} className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 text-gray-600"><FiMinus size={13} /></button>
                  <span className="w-9 text-center text-sm font-bold">{item.quantity}</span>
                  <button type="button" onClick={() => updateQuantity(item.productId, item.variant, item.quantity + 1, item.cartItemId)} className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 text-gray-600"><FiPlus size={13} /></button>
                </div>
                <button type="button" onClick={() => removeFromCart(item.productId, item.variant, item.cartItemId)} className="text-red-400 hover:text-red-600 transition-colors p-1"><FiTrash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>

        <div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden sticky top-24">
            <div className="px-5 py-4 border-b bg-gray-50/80"><h2 className="font-bold text-base">Order Summary</h2></div>
            <div className="p-5 space-y-3">
              <div className="flex justify-between text-sm text-gray-600"><span>Items ({cart.reduce((s, i) => s + i.quantity, 0)})</span><span>{formatPrice(cartTotal)}</span></div>
              <div className="rounded-xl border border-primary-100 bg-primary-50/70 px-3 py-3 text-sm text-gray-700 flex gap-2"><FiTruck size={16} className="text-primary-600 mt-0.5 shrink-0" /><span>Delivery charges are added after you select your state. Tamil Nadu delivery is free; other states may include a charge.</span></div>
              <div className="border-t border-dashed pt-3 flex justify-between font-bold text-lg"><span>Subtotal</span><span className="text-primary-600">{formatPrice(cartTotal)}</span></div>
              <button type="button" onClick={() => router.push('/checkout')} className="btn-accent w-full py-4 text-base font-bold flex items-center justify-center gap-2">Proceed to Checkout</button>
              <Link href="/shop" className="block text-center text-sm text-gray-400 hover:text-primary-600 transition-colors mt-1">Continue Shopping</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
