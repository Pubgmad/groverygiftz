'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { formatPrice } from '@/lib/utils';
import { FiHeart, FiLogOut, FiPackage, FiShoppingBag, FiUser } from 'react-icons/fi';

const normalizeStatus = (status) => {
  if (status === 'pending') return 'ordered';
  return status || 'ordered';
};

export default function AccountPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/register?callbackUrl=/account');
    if (status === 'authenticated' && session?.user?.type === 'admin') router.replace('/account/manage');
  }, [status, router, session]);

  useEffect(() => {
    if (session?.user?.type === 'customer') {
      fetch('/api/orders')
        .then((r) => r.json())
        .then((d) => setOrders(d.orders || []))
        .catch(() => {});
    }
  }, [session]);

  const totalSpent = useMemo(() => orders.reduce((sum, order) => sum + Number(order.paymentStatus === 'paid' ? order.total || 0 : 0), 0), [orders]);
  const confirmedOrders = orders.filter((order) => normalizeStatus(order.status) !== 'cancelled').length;

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
              <Link href="/account/orders" className="rounded-2xl bg-primary-50 p-4 text-left transition hover:bg-primary-100 focus:outline-none focus:ring-2 focus:ring-primary-500">
                <FiShoppingBag className="mb-2 text-primary-600" />
                <p className="text-2xl font-extrabold text-gray-950">{orders.length}</p>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Total orders</p>
                <p className="mt-1 text-xs font-bold text-primary-700">View product details</p>
              </Link>
              <Link href="/account/orders?filter=confirmed" className="rounded-2xl bg-orange-50 p-4 text-left transition hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-accent-500">
                <FiPackage className="mb-2 text-accent-600" />
                <p className="text-2xl font-extrabold text-gray-950">{confirmedOrders}</p>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Confirmed orders</p>
                <p className="mt-1 text-xs font-bold text-accent-700">View confirmed details</p>
              </Link>
              <div className="rounded-2xl bg-rose-50 p-4">
                <FiHeart className="mb-2 text-rose-500" />
                <p className="text-2xl font-extrabold text-gray-950">{formatPrice(totalSpent)}</p>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Paid purchases</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}