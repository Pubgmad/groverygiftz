'use client';
import { useEffect, useState } from 'react';
import { FiPackage, FiShoppingCart, FiUsers, FiGrid, FiDollarSign, FiMail, FiMessageSquare, FiBookOpen, FiTool } from 'react-icons/fi';
import { formatPrice } from '@/lib/utils';
import Link from 'next/link';
import useAdminAccess from '@/hooks/useAdminAccess';

export default function AdminDashboard() {
  const { canRead } = useAdminAccess();
  const [stats, setStats] = useState(null);
  const [opsAlerts, setOpsAlerts] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/stats')
      .then(r => r.json())
      .then(d => { setStats(d); setLoading(false); })
      .catch(() => setLoading(false));
    if (canRead('orders') || canRead('operations')) {
      fetch('/api/admin/ops/board', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => setOpsAlerts(d?.alerts || null))
        .catch(() => setOpsAlerts(null));
    }
  }, [canRead]);

  if (loading) return <div className="text-center py-12">Loading dashboard...</div>;

  const cards = [
    { module: 'products', label: 'Products', value: stats?.products || 0, icon: FiPackage, color: 'bg-blue-500', href: '/account/manage/products' },
    { module: 'making-cost', label: 'Making Cost missing', value: stats?.missingMakingCosts ?? '—', icon: FiTool, color: 'bg-orange-500', href: '/account/manage/making-cost' },
    { module: 'orders', label: 'Orders', value: stats?.orders || 0, icon: FiShoppingCart, color: 'bg-green-500', href: '/account/manage/orders' },
    { module: 'revenue', label: 'Revenue', value: formatPrice(stats?.revenue || 0), icon: FiDollarSign, color: 'bg-yellow-500', href: '/account/manage/revenue' },
    { module: 'customers', label: 'Customers', value: stats?.customers || 0, icon: FiUsers, color: 'bg-purple-500', href: '/account/manage/customers' },
    { module: 'collections', label: 'Collections', value: stats?.collections || 0, icon: FiGrid, color: 'bg-pink-500', href: '/account/manage/collections' },
    { module: 'blogs', label: 'Blogs', value: stats?.blogs || 0, icon: FiBookOpen, color: 'bg-indigo-500', href: '/account/manage/blogs' },
    { module: 'newsletter', label: 'Subscribers', value: stats?.subscribers || 0, icon: FiMail, color: 'bg-teal-500', href: '/account/manage/newsletter' },
    { module: 'messages', label: 'Unread Messages', value: stats?.unreadMessages || 0, icon: FiMessageSquare, color: 'bg-red-500', href: '/account/manage/messages' },
  ].filter((card) => canRead(card.module));

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      {(canRead('orders') || canRead('operations')) && opsAlerts ? (
        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          <Link href="/account/manage/operations?opsStatus=delayed" className="rounded-xl border border-red-200 bg-red-50 p-4 hover:shadow-sm">
            <p className="text-2xl font-bold text-red-800">{opsAlerts.overdue ?? 0}</p>
            <p className="text-sm font-semibold text-red-900">Overdue expected dispatch</p>
            <p className="text-xs text-red-800/80">Expected day passed · not yet dispatched</p>
          </Link>
          <Link href="/account/manage/orders" className="rounded-xl border border-amber-200 bg-amber-50 p-4 hover:shadow-sm">
            <p className="text-2xl font-bold text-amber-900">{opsAlerts.dueToday ?? 0}</p>
            <p className="text-sm font-semibold text-amber-950">Dispatch due today</p>
            <p className="text-xs text-amber-900/80">Expected dispatch date is today (IST)</p>
          </Link>
        </div>
      ) : null}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {cards.map(card => (
          <Link key={card.label} href={card.href} className="bg-white p-6 rounded-xl border hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className={`w-12 h-12 ${card.color} rounded-lg flex items-center justify-center`}>
                <card.icon className="text-white" size={20} />
              </div>
            </div>
            <p className="text-2xl font-bold">{card.value}</p>
            <p className="text-sm text-gray-500">{card.label}</p>
          </Link>
        ))}
      </div>

      {/* Recent Orders */}
      {canRead('orders') && <div className="bg-white rounded-xl border p-6">
        <h2 className="font-bold text-lg mb-4">Recent Orders</h2>
        {stats?.recentOrders?.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead><tr className="border-b text-left text-gray-500"><th className="pb-3">Order</th><th className="pb-3">Date</th><th className="pb-3">Status</th><th className="pb-3 text-right">Total</th></tr></thead>
              <tbody>
                {stats.recentOrders.map(order => (
                  <tr key={order._id} className="border-b last:border-0">
                    <td className="py-3 font-medium">{order.orderNumber}</td>
                    <td className="py-3 text-gray-500">{new Date(order.createdAt).toLocaleDateString()}</td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                        order.status === 'dispatched' || order.status === 'shipped' || order.status === 'delivered' ? 'bg-amber-100 text-amber-800' :
                        order.status === 'on_process' || order.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                        'bg-green-100 text-green-800'
                      }`}>{String(order.status || 'ordered').replace('on_process', 'on process').replace('processing', 'on process').replace('dispatched', 'Order Dispatched').replace('shipped', 'Order Dispatched').replace('delivered', 'Order Dispatched')}</span>
                    </td>
                    <td className="py-3 text-right font-medium">{formatPrice(order.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">No orders yet</p>
        )}
      </div>}
    </div>
  );
}
