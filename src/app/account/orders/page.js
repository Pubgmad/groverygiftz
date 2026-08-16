'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { FiArrowLeft, FiBox, FiCheck, FiShoppingBag, FiTruck } from 'react-icons/fi';
import CourierTrackingIdDisplay from '@/components/orders/CourierTrackingIdDisplay';
import { formatPrice } from '@/lib/utils';

const normalizeStatus = (status) => {
  if (status === 'processing') return 'on_process';
  if (status === 'shipped' || status === 'delivered') return 'dispatched';
  if (status === 'pending') return 'ordered';
  return status || 'ordered';
};

const timelineSteps = [
  { key: 'ordered', title: 'Order Confirmed', text: 'Your order has been confirmed.', icon: FiCheck },
  { key: 'on_process', title: 'Preparing Your Order', text: 'Your personalized gift is being prepared.', icon: FiBox },
  { key: 'dispatched', title: 'Out for Delivery', text: 'Your order has been dispatched.', icon: FiTruck },
];

const statusIndex = (status) => Math.max(0, timelineSteps.findIndex((step) => step.key === normalizeStatus(status)));

const orderItemCount = (order) => (order.items || []).reduce((sum, item) => sum + Number(item.quantity || 1), 0);
const addressLine = (address = {}) => [address.line1, address.line2, address.city, address.state, address.pincode].filter(Boolean).join(', ');
const orderDate = (order) => new Date(order.paidAt || order.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const customEntries = (item) => Object.entries(item?.customFields || {}).filter(([, value]) => {
  if (value == null || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  return typeof value !== 'object';
});

function OrderTimeline({ order }) {
  const normalized = normalizeStatus(order.status);
  if (normalized === 'cancelled') {
    return <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">This order has been cancelled.</p>;
  }

  const current = statusIndex(order.status);
  return (
    <div className="rounded-2xl border bg-white p-4">
      <h2 className="mb-4 font-extrabold text-gray-950">Order Timeline</h2>
      <div className="relative space-y-5">
        <div className="absolute bottom-5 left-5 top-5 w-px bg-gray-200" />
        {timelineSteps.map((step, idx) => {
          const Icon = step.icon;
          const active = idx <= current;
          return (
            <div key={step.key} className="relative flex gap-3">
              <div className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                {active ? <FiCheck size={18} /> : <Icon size={18} />}
              </div>
              <div className="min-w-0 flex-1 pb-1">
                <p className="font-bold text-gray-900">{step.title}</p>
                <p className="mt-0.5 text-sm text-gray-500">{step.text}</p>
                <p className={`mt-1 text-xs font-semibold ${active ? 'text-green-700' : 'text-gray-400'}`}>{active ? 'Completed' : 'Pending'}</p>
              </div>
            </div>
          );
        })}
      </div>
      {normalized === 'dispatched' && order.trackingNumber && <div className="mt-4"><CourierTrackingIdDisplay trackingNumber={order.trackingNumber} /></div>}
      {normalized === 'dispatched' && !order.trackingNumber && <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">Your parcel is dispatched. ST Couriers tracking ID will appear here after our team saves it.</p>}
    </div>
  );
}

function OrdersContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const confirmedOnly = searchParams.get('filter') === 'confirmed';
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/login');
    if (status === 'authenticated' && session?.user?.type === 'admin') router.replace('/account/manage');
  }, [status, router, session]);

  useEffect(() => {
    if (session?.user?.type !== 'customer') return;
    setLoadingOrders(true);
    fetch('/api/orders')
      .then((r) => r.json())
      .then((d) => setOrders(d.orders || []))
      .catch(() => setOrders([]))
      .finally(() => setLoadingOrders(false));
  }, [session]);

  const visibleOrders = useMemo(() => {
    if (!confirmedOnly) return orders;
    return orders.filter((order) => normalizeStatus(order.status) !== 'cancelled');
  }, [orders, confirmedOnly]);

  if (status === 'loading') return <div className="py-16 text-center text-gray-500">Loading...</div>;
  if (!session) return null;
  if (session.user.type !== 'customer') return <div className="py-16 text-center text-gray-500">Opening store dashboard...</div>;

  return (
    <div className="bg-gradient-to-b from-orange-50/70 via-white to-primary-50/40">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <Link href="/account" className="mb-3 inline-flex items-center gap-2 text-sm font-bold text-primary-700"><FiArrowLeft /> Back to account</Link>
            <p className="section-eyebrow text-primary-600">Customer Orders</p>
            <h1 className="font-display text-3xl font-extrabold text-gray-950 sm:text-4xl">{confirmedOnly ? 'Confirmed Orders' : 'Order History'}</h1>
            <p className="mt-1 text-sm text-gray-500">Product details and delivery address for your orders.</p>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
            <Link href="/account/orders" className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${confirmedOnly ? 'border border-gray-200 bg-white text-gray-700' : 'bg-primary-600 text-white'}`}>Total orders</Link>
            <Link href="/account/orders?filter=confirmed" className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${confirmedOnly ? 'bg-primary-600 text-white' : 'border border-gray-200 bg-white text-gray-700'}`}>Confirmed orders</Link>
          </div>
        </div>

        {loadingOrders ? (
          <div className="rounded-3xl border bg-white p-8 text-center text-gray-500 shadow-sm">Loading orders...</div>
        ) : visibleOrders.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-primary-200 bg-white p-8 text-center shadow-sm sm:p-12">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
              <FiShoppingBag size={28} />
            </div>
            <h3 className="font-display text-2xl font-bold text-gray-950">No orders found</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">Your ordered product details and delivery address will appear here after payment.</p>
            <Link href="/shop" className="btn-primary mt-6 inline-flex">Explore Gifts</Link>
          </div>
        ) : (
          <div className="space-y-5">
            {visibleOrders.map((order) => {
              const itemCount = orderItemCount(order);
              return (
                <div key={order._id} className="overflow-hidden rounded-3xl border bg-white shadow-sm">
                  <div className="border-b bg-gray-50/70 p-4 sm:p-5">
                    <p className="break-words text-xs font-bold uppercase tracking-wider text-primary-600">Order #{order.orderNumber}</p>
                    <p className="mt-1 text-sm text-gray-500">{orderDate(order)} - {itemCount} item{itemCount === 1 ? '' : 's'}</p>
                  </div>

                  <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)]">
                    <div className="min-w-0">
                      <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-gray-500">Product Details</h2>
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

                    <div className="min-w-0 space-y-4">
                      <div className="rounded-2xl border bg-gray-50 p-4 text-sm">
                        <h2 className="mb-3 font-extrabold text-gray-950">Delivery Address</h2>
                        {order.shippingAddress ? (
                          <div className="space-y-1 text-gray-600">
                            <p className="break-words font-bold text-gray-950">{order.shippingAddress.fullName}</p>
                            <p className="break-words">{addressLine(order.shippingAddress)}</p>
                            <p className="break-words">Mobile: {order.shippingAddress.phone}</p>
                            {order.shippingAddress.whatsappNumber && <p className="break-words">WhatsApp: {order.shippingAddress.whatsappNumber}</p>}
                            <p className="break-words">{order.shippingAddress.email || order.guestEmail}</p>
                          </div>
                        ) : (
                          <p className="text-gray-500">No address available for this order.</p>
                        )}
                      </div>
                      <OrderTimeline order={order} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AccountOrdersPage() {
  return (
    <Suspense fallback={<div className="py-16 text-center text-gray-500">Loading...</div>}>
      <OrdersContent />
    </Suspense>
  );
}