'use client';
import { useCart } from '@/context/CartContext';
import { FiX, FiPlus, FiMinus, FiTrash2, FiShoppingBag, FiTruck, FiGift } from 'react-icons/fi';
import Link from 'next/link';
import { formatPrice } from '@/lib/utils';

export default function CartDrawer() {
  const { cart, isCartOpen, setIsCartOpen, removeFromCart, updateQuantity, cartTotal, cartCount } = useCart();
  if (!isCartOpen) return null;

  return (
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsCartOpen(false)} />
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col">
        <div className="h-1 bg-gradient-to-r from-primary-600 via-accent-500 to-primary-600" />
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2"><FiShoppingBag size={20} className="text-primary-600" /><h2 className="text-xl font-display font-bold">My Cart</h2>{cartCount > 0 && <span className="bg-accent-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">{cartCount}</span>}</div>
          <button onClick={() => setIsCartOpen(false)} className="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-800"><FiX size={22} /></button>
        </div>

        {cart.length > 0 && (
          <div className="px-6 py-3 bg-primary-50/60 border-b text-sm text-gray-700 flex gap-2">
            <FiTruck size={15} className="text-primary-600 mt-0.5 shrink-0" />
            <span>Delivery is calculated at checkout from the selected state.</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-4">
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
                <div key={idx} className="flex gap-3 bg-gray-50 p-3 rounded-xl border border-gray-100">
                  {item.image ? <img src={item.image} alt={item.title} className="w-20 h-20 object-cover rounded-lg flex-shrink-0 shadow-sm" /> : <div className="w-20 h-20 rounded-lg flex-shrink-0 bg-primary-100 flex items-center justify-center text-primary-600"><FiGift size={24} /></div>}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm leading-snug line-clamp-2">{item.title}</h4>
                    {item.variant && <p className="text-xs text-gray-500 mt-0.5">{item.variant}</p>}
                    {item.giftWrap && <p className="text-xs text-primary-600 mt-0.5">Gift wrapped</p>}
                    {item.customizationPreview?.uploadedFile?.url && <p className="text-xs text-accent-600 mt-0.5">Preview saved</p>}
                    <p className="font-bold text-primary-600 mt-1">{formatPrice(item.price * item.quantity)}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden"><button onClick={() => updateQuantity(item.productId, item.variant, item.quantity - 1)} className="w-7 h-7 flex items-center justify-center hover:bg-gray-200 transition-colors text-gray-600"><FiMinus size={12} /></button><span className="w-8 text-center text-sm font-semibold">{item.quantity}</span><button onClick={() => updateQuantity(item.productId, item.variant, item.quantity + 1)} className="w-7 h-7 flex items-center justify-center hover:bg-gray-200 transition-colors text-gray-600"><FiPlus size={12} /></button></div>
                      <button onClick={() => removeFromCart(item.productId, item.variant)} className="ml-auto w-7 h-7 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><FiTrash2 size={14} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {cart.length > 0 && (
          <div className="border-t px-6 py-5 space-y-4 bg-white">
            <div className="flex justify-between items-center"><span className="text-gray-600 font-medium">Subtotal</span><span className="text-xl font-bold text-primary-700">{formatPrice(cartTotal)}</span></div>
            <Link href="/checkout" onClick={() => setIsCartOpen(false)} className="flex items-center justify-center gap-2 btn-accent w-full text-center text-base font-bold py-4">Checkout Now</Link>
            <Link href="/cart" onClick={() => setIsCartOpen(false)} className="block w-full text-center text-sm font-semibold text-primary-600 hover:text-primary-700 transition-colors">View cart</Link>
            <button onClick={() => setIsCartOpen(false)} className="w-full text-center text-sm text-gray-500 hover:text-primary-600 transition-colors">Continue Shopping</button>
          </div>
        )}
      </div>
    </div>
  );
}
