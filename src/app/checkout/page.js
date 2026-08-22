'use client';
import { useState, useEffect, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useCart } from '@/context/CartContext';
import { formatPrice } from '@/lib/utils';
import { buildCartMetaPayload, trackMetaEvent } from '@/lib/metaPixel';
import { FiChevronRight, FiCheckCircle, FiShield, FiTruck, FiCreditCard, FiMapPin, FiEdit2, FiGift, FiStar } from 'react-icons/fi';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { calculateCartShipping, isTamilNadu } from '@/lib/shipping';

const STEPS = ['Address', 'Payment', 'Confirm'];
const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand',
  'West Bengal', 'Delhi', 'Jammu & Kashmir', 'Ladakh', 'Puducherry',
];

export default function CheckoutPage() {
  const { cart, cartTotal, clearCart, cartReady } = useCart();
  const { data: session, status } = useSession();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [address, setAddress] = useState({ fullName: '', email: '', phone: '', whatsappNumber: '', line1: '', line2: '', city: '', state: '', pincode: '' });
  const [orderNote, setOrderNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({
    cashfreeEnabled: false,
    tamilNaduShippingCost: 0,
    otherStateShippingCost: 120,
    tamilNaduDeliveryEstimate: 'Within 8 days',
    otherStateDeliveryEstimate: '10-15 days',
    deliveryHolidays: [],
  });
  const [orderResult, setOrderResult] = useState(null);
  const checkoutTrackedRef = useRef(false);
  const returnVerifyRef = useRef('');

  const hasSelectedState = Boolean(address.state);
  const outOfTamilNadu = hasSelectedState && !isTamilNadu(address.state);
  const showOrderNote = cart.some((item) => item.customerNotesEnabled !== false);
  const shippingSummary = calculateCartShipping(cart, address.state, settings);
  const shippingCost = hasSelectedState ? shippingSummary.cost : 0;
  const deliveryEstimate = shippingSummary.estimate;
  const grandTotal = cartTotal + shippingCost;
  const getCartPixelPayload = (items = cart, total = grandTotal, extra = {}) => buildCartMetaPayload(items, total, extra);

  useEffect(() => {
    if (status === 'unauthenticated') {
      const returnedOrderId = new URLSearchParams(window.location.search).get('cashfree_order_id');
      const callbackUrl = returnedOrderId ? `/checkout?cashfree_order_id=${encodeURIComponent(returnedOrderId)}` : '/checkout';
      router.replace(`/auth/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
    }
  }, [status, router]);

  useEffect(() => {
    const savedState = window.localStorage?.getItem('groveryDeliveryState');
    if (savedState) setAddress((p) => ({ ...p, state: p.state || savedState }));
  }, []);

  useEffect(() => {
    if (address.state) window.localStorage?.setItem('groveryDeliveryState', address.state);
  }, [address.state]);

  useEffect(() => {
    if (session?.user?.type === 'customer') {
      setAddress((p) => ({ ...p, fullName: p.fullName || session.user.name || '', email: p.email || session.user.email || '' }));
    }
  }, [session]);

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((d) => setSettings({
        cashfreeEnabled: !!d.cashfreeEnabled,
        tamilNaduShippingCost: Number(d.tamilNaduShippingCost ?? 0),
        otherStateShippingCost: Number(d.otherStateShippingCost ?? d.shippingCost ?? 120),
        tamilNaduDeliveryEstimate: d.tamilNaduDeliveryEstimate || 'Within 8 days',
        otherStateDeliveryEstimate: d.otherStateDeliveryEstimate || '10-15 days',
        deliveryHolidays: Array.isArray(d.deliveryHolidays) ? d.deliveryHolidays : [],
      }))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const returnedOrderId = new URLSearchParams(window.location.search).get('cashfree_order_id');
    if (returnedOrderId) return;
    if (!cartReady) return;
    if (cart.length === 0 && step !== 3 && status === 'authenticated' && session?.user?.type === 'customer') router.replace('/cart');
  }, [cart, cartReady, step, router, status, session]);
  useEffect(() => {
    const returnedOrderId = new URLSearchParams(window.location.search).get('cashfree_order_id');
    if (!returnedOrderId || status !== 'authenticated' || session?.user?.type !== 'customer') return;
    if (returnVerifyRef.current === returnedOrderId) return;
    returnVerifyRef.current = returnedOrderId;
    setLoading(true);
    setStep(2);
    verifyCashfreeOrder(returnedOrderId)
      .then((success) => {
        if (success) router.replace('/checkout', { scroll: false });
      })
      .finally(() => setLoading(false));
  }, [status, session, router]);

  useEffect(() => {
    if (checkoutTrackedRef.current || !cartReady || status !== 'authenticated' || session?.user?.type !== 'customer' || cart.length === 0 || step === 3) return;
    checkoutTrackedRef.current = true;
    trackMetaEvent('InitiateCheckout', getCartPixelPayload(cart, grandTotal));
  }, [cart, cartReady, grandTotal, status, step, session]);

  const validateAddress = () => {
    const { fullName, email, phone, whatsappNumber, line1, city, state, pincode } = address;
    if (!fullName.trim()) return 'Full name is required';
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) return 'Valid email is required';
    if (!phone.trim() || !/^[6-9]\d{9}$/.test(phone.replace(/\s/g, ''))) return 'Valid 10-digit Indian mobile number required';
    if (!whatsappNumber.trim() || !/^[6-9]\d{9}$/.test(whatsappNumber.replace(/\s/g, ''))) return 'Valid 10-digit WhatsApp number required';
    if (!line1.trim()) return 'Address line 1 is required';
    if (!city.trim()) return 'City is required';
    if (!state) return 'State is required';
    if (!pincode.trim()) return 'Pincode is required';
    if (!/^[1-9]\d{5}$/.test(pincode.trim())) return 'Enter a valid 6-digit pincode';
    return null;
  };

  const showSuccessfulOrder = (verifyData, fallbackItems = cart, fallbackTotals = {}) => {
    const placedItems = verifyData.items?.length ? verifyData.items : fallbackItems.map((item) => ({ ...item }));
    const paidTotal = verifyData.total ?? fallbackTotals.total ?? grandTotal;
    trackMetaEvent('Purchase', getCartPixelPayload(placedItems, paidTotal, { order_id: verifyData.orderNumber }));
    clearCart();
    setOrderResult({
      orderNumber: verifyData.orderNumber,
      paymentMethod: 'Cashfree',
      items: placedItems,
      subtotal: verifyData.subtotal ?? fallbackTotals.subtotal ?? cartTotal,
      shippingCost: verifyData.shippingCost ?? fallbackTotals.shippingCost ?? shippingCost,
      total: paidTotal,
      deliveryEstimate: verifyData.deliveryEstimate || fallbackTotals.deliveryEstimate || deliveryEstimate,
    });
    setStep(3);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const verifyCashfreeOrder = async (orderId, fallbackItems = cart, fallbackTotals = {}) => {
    const verifyRes = await fetch('/api/orders/verify-cashfree-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId }),
    });
    const verifyData = await verifyRes.json();
    if (verifyRes.ok && verifyData.success) {
      showSuccessfulOrder(verifyData, fallbackItems, fallbackTotals);
      return true;
    }
    toast.error(verifyData.error || 'Payment is pending. Please contact support if amount was debited.');
    return false;
  };

  const handleAddressNext = () => {
    const err = validateAddress();
    if (err) { toast.error(err); return; }
    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCashfreePayment = async () => {
    if (status !== 'authenticated') {
      router.replace('/auth/login?callbackUrl=/checkout');
      return;
    }
    setLoading(true);
    try {
      const placedItems = cart.map((item) => ({ ...item }));
      const createRes = await fetch('/api/orders/create-cashfree-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: cart, shippingAddress: address, notes: showOrderNote ? orderNote : '' }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) {
        toast.error(createData.error || 'Payment is not configured yet');
        setLoading(false);
        return;
      }

      const scriptLoaded = await loadCashfreeScript();
      if (!scriptLoaded || !window.Cashfree) {
        toast.error('Unable to load Cashfree payment. Please try again.');
        setLoading(false);
        return;
      }

      trackMetaEvent('AddPaymentInfo', getCartPixelPayload(cart, createData.total ?? grandTotal, { payment_method: 'Cashfree' }));

      const cashfree = window.Cashfree({ mode: createData.mode || 'sandbox' });
      const result = await cashfree.checkout({ paymentSessionId: createData.paymentSessionId, redirectTarget: '_self' });
      if (result?.error) {
        toast.error(result.error.message || 'Payment was not completed');
        setLoading(false);
        return;
      }

      await verifyCashfreeOrder(createData.cashfreeOrderId, placedItems, {
        total: createData.total ?? grandTotal,
        shippingCost: createData.shippingCost ?? shippingCost,
        subtotal: cartTotal,
        deliveryEstimate: createData.deliveryEstimate || deliveryEstimate,
      });
    } catch (err) {
      console.error(err);
      toast.error('Payment error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading' || status === 'unauthenticated') {
    return <div className="min-h-[60vh] flex items-center justify-center text-gray-500">Opening secure sign in...</div>;
  }

  if (session?.user?.type === 'customer' && !cartReady) {
    return <div className="min-h-[60vh] flex items-center justify-center text-gray-500">Restoring your cart...</div>;
  }

  if (session?.user?.type !== 'customer') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-md rounded-2xl border bg-white p-6 text-center shadow-sm">
          <h1 className="text-2xl font-display font-bold mb-2">Customer sign in required</h1>
          <p className="text-sm text-gray-500 mb-5">You are signed in as store admin. Please sign out and sign in with a customer account to place an order.</p>
          <button onClick={() => signOut({ callbackUrl: '/auth/login?callbackUrl=/checkout' })} className="btn-primary w-full">Sign in as customer</button>
        </div>
      </div>
    );
  }

  if (step === 3 && orderResult) {
    return (
      <div className="min-h-[70vh] bg-gradient-to-b from-primary-50/80 to-white px-4 py-14">
        <div className="max-w-3xl mx-auto bg-white rounded-2xl border shadow-sm p-6 md:p-8">
          <div className="text-center border-b pb-6 mb-6">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5"><FiCheckCircle size={42} className="text-green-500" /></div>
            <h1 className="text-3xl font-display font-bold mb-2">Order placed successfully</h1>
            <p className="text-gray-500 mb-2">Payment received through Cashfree. Your GroveryGiftz order ID is</p>
            <p className="text-2xl font-extrabold text-primary-600 tracking-tight">{orderResult.orderNumber}</p>
            <p className="text-sm text-gray-500 mt-2">Estimated delivery: <span className="font-semibold text-gray-900">{orderResult.deliveryEstimate}</span></p>
            <p className="mt-3 inline-flex rounded-full bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800">Kindly take screen shot for your reference</p>
          </div>

          <div className="space-y-3 mb-6">
            <h2 className="font-bold text-lg">Order items</h2>
            {orderResult.items.map((item, idx) => (
              <div key={`${item.title}-${idx}`} className="flex gap-3 rounded-xl border bg-gray-50 p-3">
                {item.image ? <img src={item.image} alt={item.title} className="h-16 w-16 rounded-lg object-cover" /> : <div className="h-16 w-16 rounded-lg bg-primary-100 flex items-center justify-center text-primary-700"><FiGift /></div>}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 line-clamp-2">{item.title}</p>
                  <p className="text-xs text-gray-500">Qty {item.quantity}{item.variant ? ` · ${item.variant}` : ''}</p>
                </div>
                <p className="font-bold text-primary-600 shrink-0">{formatPrice(item.price * item.quantity)}</p>
              </div>
            ))}
          </div>

          <div className="mb-6 rounded-2xl border border-primary-100 bg-primary-50/40 p-4">
            <h2 className="font-bold text-lg mb-1">Share your product review</h2>
            <p className="text-xs text-gray-500 mb-3">Reviews are shown only after successful payment.</p>
            <div className="space-y-2">
              {orderResult.items.map((item, idx) => <CheckoutReviewForm key={`${item.productId || item.title}-${idx}`} orderNumber={orderResult.orderNumber} item={item} customerName={session?.user?.name} />)}
            </div>
          </div>

          <div className="rounded-xl bg-primary-50/70 border border-primary-100 p-4 space-y-2 text-sm mb-6">
            <div className="flex justify-between"><span>Items total</span><span>{formatPrice(orderResult.subtotal)}</span></div>
            <div className="flex justify-between"><span>Delivery charge</span><span>{orderResult.shippingCost === 0 ? 'FREE' : formatPrice(orderResult.shippingCost)}</span></div>
            <div className="border-t border-primary-100 pt-2 flex justify-between font-bold text-base"><span>Total paid</span><span>{formatPrice(orderResult.total)}</span></div>
          </div>

          <div className="flex gap-3 justify-center flex-wrap">
            <Link href="/account" className="btn-primary w-full px-6 py-3 text-center sm:w-auto sm:px-8">View Orders</Link>
            <Link href="/track-order" className="btn-outline w-full px-6 py-3 text-center sm:w-auto sm:px-8">Track Order</Link>
            <Link href="/shop" className="btn-outline w-full px-6 py-3 text-center sm:w-auto sm:px-8">Continue Shopping</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-center gap-2 mb-10">
        {STEPS.map((s, i) => {
          const num = i + 1;
          const active = step === num;
          const done = step > num;
          return (
            <div key={s} className="flex items-center gap-2">
              <div className={`flex items-center gap-2 ${active ? 'text-primary-600' : done ? 'text-green-500' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 ${active ? 'border-primary-600 bg-primary-600 text-white' : done ? 'border-green-500 bg-green-500 text-white' : 'border-gray-300 bg-white'}`}>{done ? '✓' : num}</div>
                <span className={`font-semibold text-sm hidden sm:block ${active ? 'text-primary-600' : done ? 'text-green-600' : 'text-gray-400'}`}>{s}</span>
              </div>
              {i < STEPS.length - 1 && <FiChevronRight size={16} className="text-gray-300 mx-1" />}
            </div>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {step === 1 && (
            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 px-6 py-4 border-b bg-primary-50/50"><div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center"><FiMapPin size={16} className="text-white" /></div><h2 className="font-bold text-lg">Delivery Address</h2></div>
              <div className="p-6 space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium mb-1.5">Full Name *</label><input value={address.fullName} onChange={e => setAddress(p => ({ ...p, fullName: e.target.value }))} className="w-full border rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 text-sm" placeholder="Your full name" /></div>
                  <div><label className="block text-sm font-medium mb-1.5">Phone *</label><input value={address.phone} onChange={e => setAddress(p => ({ ...p, phone: e.target.value }))} className="w-full border rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 text-sm" placeholder="9876543210" maxLength={10} inputMode="numeric" /></div>
                  <div><div className="mb-1.5 flex items-center justify-between gap-2"><label className="block text-sm font-medium">WhatsApp Number *</label><span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">Recommended</span></div><input value={address.whatsappNumber} onChange={e => setAddress(p => ({ ...p, whatsappNumber: e.target.value }))} className="w-full border rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 text-sm" placeholder="9876543210" maxLength={10} inputMode="numeric" /><p className="mt-1.5 text-xs leading-relaxed text-gray-500">The number should be the customer’s WhatsApp number (the person placing the order), not the parcel receiver’s number.</p></div>
                </div>
                <div><label className="block text-sm font-medium mb-1.5">Email *</label><input type="email" value={address.email} onChange={e => setAddress(p => ({ ...p, email: e.target.value }))} className="w-full border rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 text-sm" placeholder="you@example.com" /></div>
                <div><label className="block text-sm font-medium mb-1.5">Address Line 1 *</label><input value={address.line1} onChange={e => setAddress(p => ({ ...p, line1: e.target.value }))} className="w-full border rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 text-sm" placeholder="House no., street name" /></div>
                <div><label className="block text-sm font-medium mb-1.5">Address Line 2 <span className="text-gray-400">(optional)</span></label><input value={address.line2} onChange={e => setAddress(p => ({ ...p, line2: e.target.value }))} className="w-full border rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 text-sm" placeholder="Area, landmark" /></div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium mb-1.5">City *</label><input value={address.city} onChange={e => setAddress(p => ({ ...p, city: e.target.value }))} className="w-full border rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 text-sm" placeholder="Coimbatore" /></div>
                  <div><label className="block text-sm font-medium mb-1.5">Pincode *</label><input value={address.pincode} onChange={e => setAddress(p => ({ ...p, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) }))} className="w-full border rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 text-sm" placeholder="641001" maxLength={6} inputMode="numeric" required /></div>
                  <div className="sm:col-span-2"><label className="block text-sm font-medium mb-1.5">State *</label><select value={address.state} onChange={e => setAddress(p => ({ ...p, state: e.target.value }))} className="w-full border rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 text-sm bg-white"><option value="">Select state</option>{INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                </div>
                {hasSelectedState && (
                  <div className={`rounded-xl border px-4 py-3 text-sm ${outOfTamilNadu ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-green-200 bg-green-50 text-green-700'}`}>
                    {outOfTamilNadu ? `Outside Tamil Nadu: delivery charge ${formatPrice(shippingCost)} applies. Estimated delivery ${deliveryEstimate}.` : `Tamil Nadu delivery is free. Estimated delivery ${deliveryEstimate}.`}
                  </div>
                )}
                {showOrderNote && <div><label className="block text-sm font-medium mb-1.5">Order Note <span className="text-gray-400">(optional)</span></label><textarea value={orderNote} onChange={e => setOrderNote(e.target.value)} rows={2} className="w-full border rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 text-sm" placeholder="Special instructions for your order..." /></div>}
                <button onClick={handleAddressNext} className="btn-primary w-full py-3.5 flex items-center justify-center gap-2 text-base font-bold">Continue to Payment <FiChevronRight size={18} /></button>
              </div>
            </div>
          )}

          {step === 2 && (
            <>
              <div className="bg-white rounded-2xl border shadow-sm p-5 flex items-start justify-between gap-4">
                <div><div className="flex items-center gap-2 mb-1"><FiMapPin size={14} className="text-primary-600" /><span className="font-semibold text-sm">Delivering to</span></div><p className="text-sm font-bold">{address.fullName} · {address.phone}</p><p className="text-sm text-gray-500">{address.line1}{address.line2 ? `, ${address.line2}` : ''}, {address.city}, {address.state} - {address.pincode}</p></div>
                <button onClick={() => setStep(1)} className="text-primary-600 hover:text-primary-700 text-sm flex items-center gap-1 font-medium flex-shrink-0"><FiEdit2 size={14} /> Edit</button>
              </div>

              <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                <div className="flex items-center gap-3 px-6 py-4 border-b bg-primary-50/50"><div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center"><FiCreditCard size={16} className="text-white" /></div><h2 className="font-bold text-lg">Secure Online Payment</h2></div>
                <div className="p-6 space-y-3">
                  <div className="flex items-center gap-4 p-4 rounded-xl border-2 border-primary-500 bg-primary-50/60">
                    <div className="w-4 h-4 rounded-full border-4 border-primary-600 bg-white" />
                    <div className="flex-1"><div className="font-semibold text-sm flex items-center gap-2"><FiCreditCard size={16} className="text-primary-600" /> Cashfree Payment <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">Required</span></div><p className="text-xs text-gray-500 mt-0.5">UPI, cards, wallets and net banking. Only prepaid online payment is available.</p></div>
                  </div>
                  {!settings.cashfreeEnabled && <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">Cashfree is not configured yet. Add Cashfree keys in Admin Settings before accepting live orders.</p>}
                </div>
                <div className="px-6 pb-5 grid sm:grid-cols-3 gap-3">{[{ icon: <FiShield size={16} />, label: '100% Secure' }, { icon: <FiTruck size={16} />, label: 'ST Couriers' }, { icon: <FiCheckCircle size={16} />, label: 'Verified Order' }].map(({ icon, label }) => <div key={label} className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-xl p-2.5"><span className="text-primary-600">{icon}</span> {label}</div>)}</div>
                <div className="px-6 pb-6">
                  <button onClick={handleCashfreePayment} disabled={loading || !settings.cashfreeEnabled} className={`btn-primary w-full py-4 flex items-center justify-center gap-2 text-base font-bold ${(loading || !settings.cashfreeEnabled) ? 'opacity-70 cursor-not-allowed' : ''}`}>{loading ? <><span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Processing...</> : <><FiCreditCard size={18} /> Pay {formatPrice(grandTotal)}</>}</button>
                  <p className="text-xs text-center text-gray-400 mt-3">By placing your order, you agree to our <Link href="/policies/terms-conditions" className="underline hover:text-primary-600">Terms</Link> and <Link href="/policies/privacy-policy" className="underline hover:text-primary-600">Privacy Policy</Link></p>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-2xl border shadow-sm overflow-hidden sticky top-24">
            <div className="px-5 py-4 border-b bg-gray-50"><h3 className="font-bold text-base">Order Summary ({cart.length} item{cart.length > 1 ? 's' : ''})</h3></div>
            <div className="max-h-72 overflow-y-auto divide-y">
              {cart.map((item, idx) => <div key={idx} className="flex gap-3 p-4"><div className="relative flex-shrink-0">{item.image ? <img src={item.image} alt={item.title} className="w-16 h-16 object-cover rounded-lg" /> : <div className="w-16 h-16 rounded-lg bg-primary-50 flex items-center justify-center text-primary-600"><FiGift /></div>}<span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-primary-600 text-white text-xs rounded-full flex items-center justify-center font-bold">{item.quantity}</span></div><div className="flex-1 min-w-0"><p className="text-sm font-medium line-clamp-2 leading-snug">{item.title}</p>{item.variant && <p className="text-xs text-gray-400 mt-0.5">{item.variant}</p>}<div className="mt-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-1"><p className="text-xs text-gray-400">{formatPrice(item.price)} x {item.quantity}</p><p className="shrink-0 text-sm font-bold text-primary-600">{formatPrice(item.price * item.quantity)}</p></div></div></div>)}
            </div>
            <div className="p-5 space-y-2.5 border-t bg-gray-50/50">
              <div className="flex justify-between text-sm text-gray-600"><span>Items ({cart.reduce((s, i) => s + i.quantity, 0)})</span><span>{formatPrice(cartTotal)}</span></div>
              <div className="flex justify-between text-sm"><span className="flex items-center gap-1.5 text-gray-600"><FiTruck size={13} className="text-primary-600" /> Delivery charge</span>{shippingCost === 0 ? <span className="text-green-600 font-bold">FREE</span> : <span className="text-gray-800 font-semibold">+{formatPrice(shippingCost)}</span>}</div>
              {hasSelectedState ? (
                <div className={`rounded-xl border px-3 py-2 text-xs ${outOfTamilNadu ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-green-200 bg-green-50 text-green-700'}`}>
                  {shippingSummary.hasCustomDelivery ? 'Product-specific delivery pricing applied.' : (outOfTamilNadu ? 'Out-of-state delivery charge applied.' : 'Tamil Nadu free delivery applied.')}
                </div>
              ) : (
                <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-500">Delivery charge appears after state selection.</div>
              )}
              <div className="border-t border-dashed" />
              <div className="flex justify-between font-bold text-base"><span>Total Amount</span><span className="text-primary-600 text-lg">{formatPrice(grandTotal)}</span></div>
            </div>
            <div className="px-5 pb-5"><div className="bg-primary-50/70 rounded-xl p-3 flex items-center gap-2 text-sm text-gray-600"><FiTruck size={16} className="text-primary-600 flex-shrink-0" /><span>Estimated delivery: <span className="font-semibold text-gray-800">{deliveryEstimate}</span></span></div></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function loadCashfreeScript() {
  return new Promise((resolve) => {
    if (window.Cashfree) { resolve(true); return; }
    const script = document.createElement('script');
    script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function CheckoutReviewForm({ orderNumber, item, customerName }) {
  const productId = String(item?.productId || item?.product || '');
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!productId || submitted) return null;

  const submitReview = async (e) => {
    e.preventDefault();
    if (!rating) return toast.error('Please select a rating');
    if (!comment.trim()) return toast.error('Please write your review');
    setSaving(true);
    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, orderNumber, name: customerName || 'Customer', rating, comment }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (res.ok) {
      setSubmitted(true);
      toast.success('Thank you for your review');
      return;
    }
    toast.error(data.error || 'Unable to submit review');
  };

  return (
    <div className="rounded-xl border bg-white p-3">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-3 text-left">
        <span className="text-sm font-semibold text-gray-900 line-clamp-1">Review {item.title}</span>
        <span className="text-xs font-bold text-primary-600">{open ? 'Close' : 'Write review'}</span>
      </button>
      {open && (
        <form onSubmit={submitReview} className="mt-3 space-y-3">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button key={star} type="button" onClick={() => setRating(star)} className="text-amber-400" aria-label={`${star} star`}>
                <FiStar size={20} className={star <= rating ? 'fill-amber-400 stroke-amber-400' : 'stroke-gray-300'} />
              </button>
            ))}
          </div>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} maxLength={1000} className="w-full rounded-lg border px-3 py-2 text-sm focus:border-primary-500 focus:outline-none" placeholder="Share your experience with this gift..." />
          <button disabled={saving} className="btn-primary px-4 py-2 text-sm">{saving ? 'Submitting...' : 'Submit Review'}</button>
        </form>
      )}
    </div>
  );
}