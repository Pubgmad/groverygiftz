'use client';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { formatPrice } from '@/lib/utils';
import CourierTrackingIdDisplay from '@/components/orders/CourierTrackingIdDisplay';
import { FiCheck, FiBox, FiTruck } from 'react-icons/fi';

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

function OrderTimeline({ order }) {
  const current = statusIndex(order.status);
  const normalized = normalizeStatus(order.status);
  if (normalized === 'cancelled') {
    return <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">This order has been cancelled. Please contact customer care.</p>;
  }

  return (
    <div className="rounded-2xl border bg-white p-4 sm:p-5">
      <div className="relative space-y-7">
        <div className="absolute left-5 top-6 bottom-6 w-px bg-gray-200" />
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
                <p className="text-sm text-gray-500 mt-0.5">{step.text}</p>
                <p className={`text-xs mt-1 ${active ? 'text-green-700' : 'text-gray-400'}`}>{active ? 'Completed' : 'Pending'}</p>
                {isDispatched && active && order.trackingNumber && (
                  <div className="mt-3 max-w-sm">
                    <CourierTrackingIdDisplay trackingNumber={order.trackingNumber} />
                  </div>
                )}
                {isDispatched && active && !order.trackingNumber && (
                  <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">Your parcel is dispatched. ST Couriers tracking ID will appear here after our team saves it.</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AccountPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/login');
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.id) {
      fetch(`/api/orders?customerId=${session.user.id}`)
        .then(r => r.json()).then(d => setOrders(d.orders || [])).catch(() => {});
    }
  }, [session]);

  if (status === 'loading') return <div className="text-center py-16">Loading...</div>;
  if (!session) return null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
        <h1 className="text-3xl font-display font-bold">My Account</h1>
        <button onClick={() => signOut({ callbackUrl: '/' })} className="btn-outline text-sm self-start sm:self-auto">Sign Out</button>
      </div>

      {session.user.type === 'admin' && (
        <div className="bg-primary-50 border border-primary-200 p-5 rounded-xl mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="font-semibold text-primary-900">Store management</p>
            <p className="text-sm text-primary-800/80">Products, orders, settings, and site content.</p>
          </div>
          <Link href="/account/manage" className="btn-primary text-center px-5 py-2.5 text-sm">Open dashboard</Link>
        </div>
      )}

      <div className="bg-white p-5 sm:p-6 rounded-xl border mb-8">
        <h2 className="font-bold text-lg mb-2">Profile</h2>
        <p className="text-gray-600 break-words">{session.user.name}</p>
        <p className="text-gray-600 break-words">{session.user.email}</p>
      </div>

      <h2 className="font-bold text-xl mb-4">Order History</h2>
      {orders.length === 0 ? (
        <p className="text-gray-500">No orders yet.</p>
      ) : (
        <div className="space-y-5">
          {orders.map(order => (
            <div key={order._id} className="bg-white p-4 sm:p-6 rounded-2xl border shadow-sm">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-4">
                <div>
                  <p className="font-bold text-gray-900">Order #{order.orderNumber}</p>
                  <p className="text-sm text-gray-500">Order date: {new Date(order.paidAt || order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                </div>
                <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700 self-start">{normalizeStatus(order.status).replace('_', ' ')}</span>
              </div>

              <div className="space-y-1 text-sm mb-4">
                {order.items?.map((item, idx) => (
                  <div key={idx} className="flex justify-between gap-3">
                    <span className="min-w-0 break-words">{item.title} x{item.quantity}</span>
                    <span className="font-semibold shrink-0">{formatPrice(item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>

              {order.deliveryEstimate && <p className="text-xs text-gray-700 bg-primary-50 px-3 py-2 rounded-lg mb-4">Estimated delivery: <span className="font-semibold text-gray-900">{order.deliveryEstimate}</span></p>}
              <OrderTimeline order={order} />

              <div className="border-t mt-4 pt-3 flex justify-between font-bold">
                <span>Total</span><span>{formatPrice(order.total)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}