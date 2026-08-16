'use client';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { formatPrice } from '@/lib/utils';
import CourierTrackingIdDisplay from '@/components/orders/CourierTrackingIdDisplay';
import { FiCheck, FiBox, FiTruck, FiStar, FiUser, FiShoppingBag, FiHeart, FiLogOut, FiPackage } from 'react-icons/fi';
import toast from 'react-hot-toast';

const normalizeStatus = (status) => {
  if (status === 'processing') return 'on_process';
  if (status === 'shipped' || status === 'delivered') return 'dispatched';
  if (status === 'pending') return 'ordered';
  return status || 'ordered';
};

const timelineSteps = [
  { key: 'ordered', title: 'Order Confirmed', text: 'Your order has been confirmed.', icon: FiCheck },
  { key: 'on_process', title: 'Preparing Your Order', text: 'Waiting for design approval.', icon: FiBox },
  { key: 'dispatched', title: 'Out for Delivery', text: 'Your order has been shipped and is on its way to you.', icon: FiTruck },
];

const statusIndex = (status) => Math.max(0, timelineSteps.findIndex((step) => step.key === normalizeStatus(status)));
const itemProductId = (item) => String(item?.productId || item?.product?._id || item?.product || '');
const orderItemCount = (order) => (order.items || []).reduce((sum, item) => sum + Number(item.quantity || 1), 0);
const addressLine = (address = {}) => [address.line1, address.line2, address.city, address.state, address.pincode].filter(Boolean).join(', ');
const orderDate = (order) => new Date(order.paidAt || order.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const orderDiscount = (order) => Math.max(0, Number(order.discount || order.discountAmount || order.couponDiscount || 0));
const customEntries = (item) => Object.entries(item?.customFields || {}).filter(([, value]) => {
  if (value == null || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  return typeof value !== 'object';
});

function OrderTimeline({ order }) {
  const current = statusIndex(order.status);
  const normalized = normalizeStatus(order.status);
  if (normalized === 'cancelled') {
    return <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">This order has been cancelled. Please contact customer care.</p>;
  }

  return (
    <div className="rounded-2xl border bg-white p-4 sm:p-5">
      <div className="relative space-y-7">
        <div className="absolute bottom-6 left-5 top-6 w-px bg-gray-200" />
        {timelineSteps.map((step, idx) => {
          const Icon = step.icon;
          const active = idx <= current;
          const isDispatched = step.key === 'dispatched';
          return (
            <div key={step.key} className="relative flex gap-4">
              <div className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                {active ? <FiCheck size={18} /> : <Icon size={18} />}
              </div>
              <div className="min-w-0 flex-1 pb-1">
                <p className="font-bold text-gray-900">{step.title}</p>
                <p className="mt-0.5 text-sm text-gray-500">{step.text}</p>
                <p className={`mt-1 text-xs ${active ? 'text-green-700' : 'text-gray-400'}`}>{active ? 'Completed' : 'Pending'}</p>
                {isDispatched && active && order.trackingNumber && <div className="mt-3 max-w-sm"><CourierTrackingIdDisplay trackingNumber={order.trackingNumber} /></div>}
                {isDispatched && active && !order.trackingNumber && <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">Your parcel is dispatched. ST Couriers tracking ID will appear here after our team saves it.</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StarInput({ value, onChange }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button key={star} type="button" onClick={() => onChange(star)} className="text-amber-400" aria-label={`${star} star`}>
          <FiStar size={20} className={star <= value ? 'fill-amber-400 stroke-amber-400' : 'stroke-gray-300'} />
        </button>
      ))}
    </div>
  );
}

function OrderReviewForm({ order, item, customerName }) {
  const productId = itemProductId(item);
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
      body: JSON.stringify({ productId, orderNumber: order.orderNumber, name: customerName || 'Customer', rating, comment }),
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
        <span className="line-clamp-1 text-sm font-semibold text-gray-900">Review {item.title}</span>
        <span className="text-xs font-bold text-primary-600">{open ? 'Close' : 'Write review'}</span>
      </button>
      {open && (
        <form onSubmit={submitReview} className="mt-3 space-y-3">
          <StarInput value={rating} onChange={setRating} />
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} maxLength={1000} className="w-full rounded-lg border px-3 py-2 text-sm focus:border-primary-500 focus:outline-none" placeholder="Share your experience after receiving or ordering this gift..." />
          <button disabled={saving} className="btn-primary px-4 py-2 text-sm">{saving ? 'Submitting...' : 'Submit Review'}</button>
        </form>
      )}
    </div>
  );
}

export default function AccountPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/login');
    if (status === 'authenticated' && session?.user?.type === 'admin') router.replace('/account/manage');
  }, [status, router, session]);

  useEffect(() => {
    if (session?.user?.type === 'customer') {
      fetch('/api/orders')
        .then(r => r.json()).then(d => setOrders(d.orders || [])).catch(() => {});
    }
  }, [session]);

  const totalSpent = useMemo(() => orders.reduce((sum, order) => sum + Number(order.paymentStatus === 'paid' ? order.total || 0 : 0), 0), [orders]);
  const confirmedOrders = orders.filter((order) => normalizeStatus(order.status) !== 'cancelled').length;
  const scrollToOrderHistory = () => document.getElementById('order-history')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  if (status === 'loading') return <div className="py-16 text-center text-gray-500">Loading...</div>;
  if (!session) return null;
  if (session.user.type !== 'customer') return <div className="py-16 text-center text-gray-500">Opening store dashboard...</div>;

  return (
    <div className="bg-gradient-to-b from-orange-50/70 via-white to-primary-50/40">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
        <section className="overflow-hidden rounded-3xl border border-orange-100 bg-white shadow-sm">
          <div className="relative p-5 sm:p-7">
            <div className="absolute inset-x-0 top-0 h-1 bg-accent-500" />
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary-600 text-white shadow-lg shadow-primary-100 sm:h-16 sm:w-16">
                  <FiUser size={26} />
                </div>
                <div className="min-w-0">
                  <p className="section-eyebrow text-accent-600">Customer Account</p>
                  <h1 className="font-display text-2xl font-extrabold text-gray-950 sm:text-4xl">Hi, {session.user.name || 'Gift Lover'}</h1>
                  <p className="mt-1 break-words text-sm text-gray-500">{session.user.email}</p>
                </div>
              </div>
              <button onClick={() => signOut({ callbackUrl: '/' })} className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-bold text-gray-700 transition hover:border-primary-200 hover:bg-primary-50 lg:self-center">
                <FiLogOut /> Sign Out
              </button>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <button type="button" onClick={scrollToOrderHistory} className="rounded-2xl bg-primary-50 p-4 text-left transition hover:bg-primary-100 focus:outline-none focus:ring-2 focus:ring-primary-500">
                <FiShoppingBag className="mb-2 text-primary-600" />
                <p className="text-2xl font-extrabold text-gray-950">{orders.length}</p>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Total orders</p>
                <p className="mt-1 text-xs font-bold text-primary-700">View order history</p>
              </button>
              <div className="rounded-2xl bg-orange-50 p-4">
                <FiPackage className="mb-2 text-accent-600" />
                <p className="text-2xl font-extrabold text-gray-950">{confirmedOrders}</p>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Confirmed orders</p>
              </div>
              <div className="rounded-2xl bg-rose-50 p-4">
                <FiHeart className="mb-2 text-rose-500" />
                <p className="text-2xl font-extrabold text-gray-950">{formatPrice(totalSpent)}</p>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Paid purchases</p>
              </div>
            </div>
          </div>
        </section>

        <section id="order-history" className="mt-8 scroll-mt-24">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="section-eyebrow text-primary-600">Orders</p>
              <h2 className="font-display text-2xl font-extrabold text-gray-950 sm:text-3xl">Order History</h2>
            </div>
            <Link href="/shop" className="btn-outline w-full justify-center text-sm sm:w-auto">Continue Shopping</Link>
          </div>

          {orders.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-primary-200 bg-white p-8 text-center shadow-sm sm:p-12">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
                <FiShoppingBag size={28} />
              </div>
              <h3 className="font-display text-2xl font-bold text-gray-950">No orders yet</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">Your personalized gift orders, tracking status, and review options will appear here after payment.</p>
              <Link href="/shop" className="btn-primary mt-6 inline-flex">Explore Gifts</Link>
            </div>
          ) : (
            <div className="space-y-5">
              {orders.map(order => {
                const itemCount = orderItemCount(order);
                const discount = orderDiscount(order);
                return (
                  <div key={order._id} className="overflow-hidden rounded-3xl border bg-white shadow-sm">
                    <div className="border-b bg-gray-50/70 p-4 sm:p-5">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="break-words text-xs font-bold uppercase tracking-wider text-primary-600">Order #{order.orderNumber}</p>
                          <p className="mt-1 text-sm text-gray-500">Order date: {orderDate(order)}</p>
                          <p className="mt-1 text-xs font-semibold text-gray-500">{itemCount} item{itemCount === 1 ? '' : 's'} - {order.paymentMethod || 'Cashfree'} {order.paymentStatus}</p>
                        </div>
                        <span className="self-start rounded-full bg-primary-600 px-3 py-1 text-xs font-bold capitalize text-white">{normalizeStatus(order.status).replace('_', ' ')}</span>
                      </div>
                    </div>

                    <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
                      <div className="min-w-0 space-y-4">
                        <div>
                          <h3 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-gray-500">Items</h3>
                          <div className="space-y-3">
                            {order.items?.map((item, idx) => {
                              const lineTotal = Number(item.price || 0) * Number(item.quantity || 1);
                              const entries = customEntries(item);
                              return (
                                <div key={idx} className="rounded-2xl bg-gray-50 p-3 sm:p-4">
                                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="min-w-0">
                                      <p className="break-words font-bold text-gray-950">{item.title}</p>
                                      {item.variant && <p className="mt-1 break-words text-xs font-semibold text-primary-700">Selected: {item.variant}</p>}
                                      <p className="mt-1 text-xs text-gray-500">Quantity {item.quantity || 1} - {formatPrice(item.price || 0)} each</p>
                                    </div>
                                    <span className="shrink-0 font-bold text-primary-700">{formatPrice(lineTotal)}</span>
                                  </div>
                                  {(entries.length > 0 || item.giftWrap || item.giftMessage) && (
                                    <div className="mt-3 rounded-xl border bg-white p-3 text-xs text-gray-600">
                                      <p className="mb-1 font-bold text-gray-800">Selections</p>
                                      {entries.map(([label, value]) => <p key={label} className="break-words"><span className="font-semibold">{label}:</span> {String(value)}</p>)}
                                      {item.giftWrap && <p>Gift wrap selected</p>}
                                      {item.giftMessage && <p className="break-words"><span className="font-semibold">Gift message:</span> {item.giftMessage}</p>}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {order.deliveryEstimate && <p className="rounded-xl bg-primary-50 px-3 py-2 text-xs text-gray-700">Estimated delivery: <span className="font-semibold text-gray-900">{order.deliveryEstimate}</span></p>}
                        <OrderTimeline order={order} />

                        {order.paymentStatus === 'paid' && order.items?.some(itemProductId) && (
                          <div className="rounded-2xl border border-primary-100 bg-primary-50/40 p-4">
                            <h3 className="mb-2 font-bold text-gray-900">Share your product review</h3>
                            <p className="mb-3 text-xs text-gray-500">Reviews are available only after successful payment.</p>
                            <div className="space-y-2">
                              {order.items.map((item, idx) => <OrderReviewForm key={String(order._id) + '-' + idx} order={order} item={item} customerName={session.user.name} />)}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 rounded-2xl border bg-gray-50 p-4 text-sm">
                        <h3 className="mb-3 font-extrabold text-gray-950">Order Summary</h3>
                        <div className="space-y-2 text-gray-600">
                          <div className="flex justify-between gap-3"><span>Order ID</span><span className="break-words text-right font-bold text-gray-950">{order.orderNumber}</span></div>
                          <div className="flex justify-between gap-3"><span>Items</span><span className="font-semibold text-gray-900">{itemCount}</span></div>
                          <div className="flex justify-between gap-3"><span>Payment</span><span className="text-right font-semibold capitalize text-gray-900">{order.paymentMethod || 'Cashfree'} {order.paymentStatus}</span></div>
                          <div className="flex justify-between gap-3"><span>Status</span><span className="text-right font-semibold capitalize text-gray-900">{normalizeStatus(order.status).replace('_', ' ')}</span></div>
                          <div className="border-t border-dashed pt-2" />
                          <div className="flex justify-between gap-3"><span>Product subtotal</span><span className="font-semibold text-gray-900">{formatPrice(order.subtotal || 0)}</span></div>
                          <div className="flex justify-between gap-3"><span>Delivery fee</span><span className="font-semibold text-gray-900">{Number(order.shippingCost || 0) === 0 ? 'FREE' : formatPrice(order.shippingCost)}</span></div>
                          {discount > 0 && <div className="flex justify-between gap-3 text-green-700"><span>Discount</span><span className="font-semibold">-{formatPrice(discount)}</span></div>}
                          <div className="border-t border-dashed pt-2" />
                          <div className="flex justify-between gap-3 text-base font-extrabold text-gray-950"><span>Total paid</span><span>{formatPrice(order.total)}</span></div>
                        </div>
                        {order.shippingAddress && (
                          <div className="mt-4 border-t pt-4">
                            <p className="mb-1 text-xs font-bold uppercase tracking-wide text-gray-500">Delivery Address</p>
                            <p className="break-words font-bold text-gray-950">{order.shippingAddress.fullName}</p>
                            <p className="break-words text-gray-600">{addressLine(order.shippingAddress)}</p>
                            <p className="break-words text-gray-600">Mobile: {order.shippingAddress.phone}</p>
                            {order.shippingAddress.whatsappNumber && <p className="break-words text-gray-600">WhatsApp: {order.shippingAddress.whatsappNumber}</p>}
                            <p className="break-words text-gray-600">{order.shippingAddress.email || order.guestEmail}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
