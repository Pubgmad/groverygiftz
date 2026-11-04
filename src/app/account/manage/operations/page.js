'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import useAdminAccess from '@/hooks/useAdminAccess';
import ReadOnlyBanner from '@/components/admin/ReadOnlyBanner';
import { OPS_STATUS_LABELS, TASK_TYPES } from '@/lib/opsConstants';
import { formatPrice } from '@/lib/utils';

export default function OperationsPage() {
  const { canRead, canWrite } = useAdminAccess();
  const readable = canRead('operations') || canRead('orders');
  const writable = canWrite('operations') || canWrite('orders');
  const [board, setBoard] = useState(null);
  const [activeStatus, setActiveStatus] = useState('');
  const [tasks, setTasks] = useState([]);
  const [taskView, setTaskView] = useState('today');
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async (opsStatus = activeStatus) => {
    setLoading(true);
    try {
      const q = opsStatus ? `?opsStatus=${encodeURIComponent(opsStatus)}` : '';
      const [boardRes, taskRes, noteRes] = await Promise.all([
        fetch(`/api/admin/ops/board${q}`, { cache: 'no-store' }),
        fetch(`/api/admin/ops/tasks?view=${taskView}`, { cache: 'no-store' }),
        fetch('/api/admin/ops/notifications?unread=1', { cache: 'no-store' }),
      ]);
      const boardData = await boardRes.json();
      const taskData = await taskRes.json();
      const noteData = await noteRes.json();
      if (!boardRes.ok) throw new Error(boardData.error || 'Board failed');
      setBoard(boardData);
      setTasks(taskData.tasks || []);
      setNotifications(noteData.notifications || []);
    } catch (err) {
      toast.error(err.message || 'Unable to load operations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!readable) return;
    load(activeStatus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readable, activeStatus, taskView]);

  if (!readable) {
    return <p className="p-6 text-sm text-gray-600">You do not have permission to view Operations.</p>;
  }

  const statuses = board?.statuses || Object.keys(OPS_STATUS_LABELS);
  const counts = board?.counts || {};

  return (
    <div className="space-y-6">
      <ReadOnlyBanner show={!writable} />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Operations</h1>
          <p className="text-sm text-gray-500">Workflow board, work planner, and notifications for sales, editing, printing, and dispatch.</p>
        </div>
        <Link href="/account/manage/orders" className="inline-flex min-h-[44px] items-center justify-center rounded-xl border px-4 py-2 text-sm font-semibold">
          Open Orders
        </Link>
      </div>

      {notifications.length > 0 ? (
        <div className="rounded-xl border bg-amber-50 p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="font-bold text-amber-950">Unread notifications ({notifications.length})</h2>
            <button
              type="button"
              className="text-sm font-semibold text-amber-900 underline"
              onClick={async () => {
                await fetch('/api/admin/ops/notifications', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ markAllRead: true }),
                });
                load(activeStatus);
              }}
            >
              Mark all read
            </button>
          </div>
          <ul className="space-y-1 text-sm text-amber-950">
            {notifications.slice(0, 8).map((n) => (
              <li key={n._id}><span className="font-semibold">{n.title}</span> — {n.body}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <button
          type="button"
          onClick={() => setActiveStatus('')}
          className={`rounded-xl border p-3 text-left ${!activeStatus ? 'border-primary-500 bg-primary-50' : 'bg-white'}`}
        >
          <p className="text-xs font-semibold text-gray-500">All active</p>
          <p className="text-xl font-bold">{Object.values(counts).reduce((a, b) => a + (typeof b === 'number' && b === counts.delayed ? 0 : (Number(b) || 0)), 0) || '—'}</p>
        </button>
        <button
          type="button"
          onClick={() => setActiveStatus('delayed')}
          className={`rounded-xl border p-3 text-left ${activeStatus === 'delayed' ? 'border-red-500 bg-red-50' : 'bg-white'}`}
        >
          <p className="text-xs font-semibold text-red-600">Delayed / Overdue</p>
          <p className="text-xl font-bold text-red-700">{counts.delayed || 0}</p>
        </button>
        {statuses.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setActiveStatus(status)}
            className={`rounded-xl border p-3 text-left ${activeStatus === status ? 'border-primary-500 bg-primary-50' : 'bg-white'}`}
          >
            <p className="text-xs font-semibold text-gray-500">{OPS_STATUS_LABELS[status] || status}</p>
            <p className="text-xl font-bold">{counts[status] || 0}</p>
          </button>
        ))}
      </div>

      <div className="rounded-xl border bg-white overflow-hidden">
        <div className="border-b bg-gray-50 px-4 py-3 font-bold">
          {activeStatus === 'delayed' ? 'Delayed orders' : activeStatus ? OPS_STATUS_LABELS[activeStatus] : 'Orders in view'}
        </div>
        {loading ? <p className="p-6 text-center text-sm">Loading…</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-gray-600">
                  <th className="p-3">Order</th>
                  <th className="p-3">Source</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Ops</th>
                  <th className="p-3">Assigned</th>
                  <th className="p-3">Dispatch</th>
                  <th className="p-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {(board?.orders || []).map((order) => (
                  <tr key={order._id} className="border-t">
                    <td className="p-3 font-bold text-primary-700">
                      <Link href={`/account/manage/orders?orderId=${encodeURIComponent(order.orderNumber || '')}`}>{order.orderNumber}</Link>
                      {order.delayed ? <span className="ml-2 text-xs font-semibold text-red-600">Delayed</span> : null}
                    </td>
                    <td className="p-3 capitalize">{order.orderSource || 'website'}</td>
                    <td className="p-3">{order.shippingAddress?.fullName || '—'}</td>
                    <td className="p-3">{OPS_STATUS_LABELS[order.opsStatus] || order.opsStatus || '—'}</td>
                    <td className="p-3">{order.assignedToName || '—'}</td>
                    <td className="p-3 text-xs">{order.expectedDispatchDate ? new Date(order.expectedDispatchDate).toLocaleDateString('en-IN') : '—'}</td>
                    <td className="p-3 text-right font-semibold">{formatPrice(order.total || 0)}</td>
                  </tr>
                ))}
                {!board?.orders?.length ? (
                  <tr><td colSpan={7} className="p-6 text-center text-gray-500">No orders in this view.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-white p-4">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-bold">Work planner</h2>
          <div className="flex flex-wrap gap-2">
            {[
              ['today', "Today's Tasks"],
              ['tomorrow', "Tomorrow's Tasks"],
              ['week', 'Upcoming 7 Days'],
              ['overdue', 'Overdue Tasks'],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTaskView(id)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${taskView === id ? 'bg-primary-600 text-white' : 'border bg-white'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {TASK_TYPES.map((type) => {
            const rows = tasks.filter((t) => t.type === type);
            return (
              <div key={type} className="rounded-xl border bg-gray-50 p-3">
                <h3 className="mb-2 text-sm font-bold capitalize">{type}</h3>
                {rows.length ? rows.map((task) => (
                  <div key={task._id} className="mb-2 rounded-lg border bg-white p-2 text-xs">
                    <p className="font-semibold">{task.title}</p>
                    <p className="text-gray-600">{task.orderNumber} · {task.status} · {task.priority}</p>
                    {task.dueDate ? <p className="text-gray-500">Due {new Date(task.dueDate).toLocaleString('en-IN')}</p> : null}
                  </div>
                )) : <p className="text-xs text-gray-500">No tasks</p>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
