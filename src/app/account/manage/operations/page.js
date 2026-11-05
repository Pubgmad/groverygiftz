'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import useAdminAccess from '@/hooks/useAdminAccess';
import ReadOnlyBanner from '@/components/admin/ReadOnlyBanner';
import { OPS_STATUS_LABELS, OPS_STATUS_HELP, TASK_TYPES, HIDDEN_OPS_BOARD_STATUSES } from '@/lib/opsConstants';
import { formatPrice } from '@/lib/utils';
import { fromDatetimeLocalIst, toDatetimeLocalIst, formatIstDateTime, todayIstYmd } from '@/lib/istTime';

export default function OperationsPage() {
  const { canRead, canWrite } = useAdminAccess();
  const readable = canRead('operations') || canRead('orders');
  const writable = canWrite('operations') || canWrite('orders');
  const [board, setBoard] = useState(null);
  const [activeStatus, setActiveStatus] = useState('ready_to_dispatch');
  const [tasks, setTasks] = useState([]);
  const [taskView, setTaskView] = useState('today');
  const [notifications, setNotifications] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [courierCompany, setCourierCompany] = useState('ST Couriers');
  const [pickupDate, setPickupDate] = useState(() => todayIstYmd());
  const [confirmPickup, setConfirmPickup] = useState(true);
  const [batchBusy, setBatchBusy] = useState(false);
  const [parcelWeight, setParcelWeight] = useState('');
  const [parcelTracking, setParcelTracking] = useState('');
  const [dispatchedAt, setDispatchedAt] = useState(() => toDatetimeLocalIst(new Date()));
  const [manualCourierCost, setManualCourierCost] = useState('');
  const [calculatedCourierCost, setCalculatedCourierCost] = useState('');
  const [destinationState, setDestinationState] = useState('');
  const [staff, setStaff] = useState([]);
  const [taskForm, setTaskForm] = useState({
    orderNumber: '',
    type: 'editing',
    title: '',
    priority: 'normal',
    assignedTo: '',
    dueDate: '',
    notes: '',
  });
  const [taskBusy, setTaskBusy] = useState(false);
  const [showBatchTools, setShowBatchTools] = useState(false);
  const [editorWorkload, setEditorWorkload] = useState([]);

  const load = async (opsStatus = activeStatus) => {
    setLoading(true);
    try {
      const q = opsStatus ? `?opsStatus=${encodeURIComponent(opsStatus)}` : '';
      const [boardRes, taskRes, noteRes, batchRes, editorsRes] = await Promise.all([
        fetch(`/api/admin/ops/board${q}`, { cache: 'no-store' }),
        fetch(`/api/admin/ops/tasks?view=${taskView}`, { cache: 'no-store' }),
        fetch('/api/admin/ops/notifications?unread=1', { cache: 'no-store' }),
        fetch('/api/admin/ops/dispatch-batches', { cache: 'no-store' }),
        fetch('/api/admin/editors/workload', { cache: 'no-store' }),
      ]);
      const boardData = await boardRes.json();
      const taskData = await taskRes.json();
      const noteData = await noteRes.json();
      const batchData = batchRes.ok ? await batchRes.json() : { batches: [] };
      const editorsData = editorsRes.ok ? await editorsRes.json() : { editors: [] };
      if (!boardRes.ok) throw new Error(boardData.error || 'Board failed');
      setBoard(boardData);
      setTasks(taskData.tasks || []);
      setNotifications(noteData.notifications || []);
      setBatches(batchData.batches || []);
      setEditorWorkload(editorsData.editors || editorsData.workloads || []);
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

  useEffect(() => {
    if (!readable) return;
    fetch('/api/admin/staff', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { staff: [] }))
      .then((d) => setStaff(d.staff || []))
      .catch(() => setStaff([]));
  }, [readable]);

  const pageIds = useMemo(() => (board?.orders || []).map((o) => String(o._id)), [board]);

  const createTask = async () => {
    const orderNumber = String(taskForm.orderNumber || '').trim();
    const title = String(taskForm.title || '').trim();
    if (!orderNumber && !title) {
      toast.error('Enter a task title (Order ID is optional for independent internal tasks)');
      return;
    }
    setTaskBusy(true);
    try {
      let orderId;
      if (orderNumber) {
        const lookup = await fetch(`/api/orders?orderId=${encodeURIComponent(orderNumber)}&limit=1`, { cache: 'no-store' });
        const lookupData = await lookup.json();
        const order = (lookupData.orders || [])[0];
        if (!lookup.ok || !order?._id) throw new Error(lookupData.error || 'Order not found');
        orderId = order._id;
      }
      const res = await fetch('/api/admin/ops/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: orderId || undefined,
          type: taskForm.type,
          title: title || undefined,
          priority: taskForm.priority,
          assignedTo: taskForm.assignedTo || undefined,
          dueDate: taskForm.dueDate || undefined,
          notes: taskForm.notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Task create failed');
      toast.success(orderId ? 'Order-linked task created' : 'Independent internal task created');
      setTaskForm((f) => ({ ...f, title: '', notes: '', orderNumber: '' }));
      await load(activeStatus);
    } catch (err) {
      toast.error(err.message || 'Task create failed');
    } finally {
      setTaskBusy(false);
    }
  };

  if (!readable) {
    return <p className="p-6 text-sm text-gray-600">You do not have permission to view Operations.</p>;
  }

  const statuses = (board?.statuses || Object.keys(OPS_STATUS_LABELS))
    .filter((s) => !HIDDEN_OPS_BOARD_STATUSES.includes(s));
  const counts = board?.counts || {};

  const createBatch = async () => {
    if (!selectedIds.size) {
      toast.error('Select ready orders first');
      return;
    }
    setBatchBusy(true);
    try {
      const res = await fetch('/api/admin/ops/dispatch-batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderIds: [...selectedIds],
          courierCompany,
          pickupDate,
          confirmPickup,
          trackingNumber: parcelTracking || undefined,
          weightKg: parcelWeight !== '' ? Number(parcelWeight) : undefined,
          dispatchedAt: (() => {
            if (!confirmPickup) return undefined;
            const d = dispatchedAt ? fromDatetimeLocalIst(dispatchedAt) : null;
            if (!d) throw new Error('Actual dispatch date/time is required for handover');
            return d.toISOString();
          })(),
          manualCourierCost: manualCourierCost !== '' ? Number(manualCourierCost) : undefined,
          calculatedCourierCost: calculatedCourierCost !== '' ? Number(calculatedCourierCost) : undefined,
          destinationState: destinationState || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Batch failed');
      toast.success(
        confirmPickup
          ? `Batch ${data.batch.batchCode} · ${data.batch.parcelCount} parcel(s) · dispatch date stored`
          : `Batch ${data.batch.batchCode} arranged · awaiting courier handover (no dispatch date yet)`,
      );
      if (data.rejected?.length) toast.error(`${data.rejected.length} order(s) skipped`);
      setSelectedIds(new Set());
      setParcelTracking('');
      setParcelWeight('');
      setManualCourierCost('');
      setCalculatedCourierCost('');
      await load(activeStatus);
    } catch (err) {
      toast.error(err.message || 'Batch failed');
    } finally {
      setBatchBusy(false);
    }
  };

  const addParcelToBatch = async (batchId) => {
    if (!selectedIds.size) {
      toast.error('Select order(s) to include in the new parcel');
      return;
    }
    setBatchBusy(true);
    try {
      const res = await fetch('/api/admin/ops/dispatch-batches', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchId,
          action: 'add_parcel',
          orderIds: [...selectedIds],
          courierCompany,
          trackingNumber: parcelTracking || undefined,
          weightKg: parcelWeight !== '' ? Number(parcelWeight) : undefined,
          dispatchedAt: (() => {
            const d = dispatchedAt ? fromDatetimeLocalIst(dispatchedAt) : null;
            if (!d) throw new Error('Actual dispatch date/time is required');
            return d.toISOString();
          })(),
          manualCourierCost: manualCourierCost !== '' ? Number(manualCourierCost) : undefined,
          calculatedCourierCost: calculatedCourierCost !== '' ? Number(calculatedCourierCost) : undefined,
          destinationState: destinationState || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Add parcel failed');
      toast.success(`Parcel ${data.parcel?.parcelCode} recorded`);
      setSelectedIds(new Set());
      await load(activeStatus);
    } catch (err) {
      toast.error(err.message || 'Add parcel failed');
    } finally {
      setBatchBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <ReadOnlyBanner show={!writable} />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Operations</h1>
          <p className="text-sm text-gray-500">Workflow board, courier pickup batches, work planner, and notifications.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/account/manage/reports" className="inline-flex min-h-[44px] items-center justify-center rounded-xl border px-4 py-2 text-sm font-semibold">
            Payment & dispatch reports
          </Link>
          <Link href="/account/manage/orders" className="inline-flex min-h-[44px] items-center justify-center rounded-xl border px-4 py-2 text-sm font-semibold">
            Open Orders
          </Link>
        </div>
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
          <p className="text-xs font-semibold text-gray-500">All listed</p>
          <p className="text-xl font-bold">{board?.orders?.length || 0}</p>
        </button>
        <button
          type="button"
          onClick={() => setActiveStatus('delayed')}
          className={`rounded-xl border p-3 text-left ${activeStatus === 'delayed' ? 'border-red-500 bg-red-50' : 'bg-white'}`}
        >
          <p className="text-xs font-semibold text-red-600" title="Expected dispatch IST day has fully passed and order is not yet dispatched">Delayed / Overdue</p>
          <p className="text-xl font-bold text-red-700">{counts.delayed || 0}</p>
        </button>
        {statuses.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setActiveStatus(status)}
            className={`rounded-xl border p-3 text-left ${activeStatus === status ? 'border-primary-500 bg-primary-50' : 'bg-white'}`}
          >
            <p className="text-xs font-semibold text-gray-500" title={OPS_STATUS_HELP[status] || ''}>{OPS_STATUS_LABELS[status] || status}</p>
            <p className="text-xl font-bold">{counts[status] || 0}</p>
          </button>
        ))}
      </div>

      {writable ? (
        <div className="rounded-xl border bg-white p-4 space-y-3">
          <h2 className="font-bold">Dispatch overview (read + optional batch tools)</h2>
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
            Primary courier / parcel entry is on each <strong>Order Details → Courier &amp; Dispatch</strong> page.
            Prefer recording handover, tracking, weight, and charges there so history stays on the Order ID.
            This Operations section remains available as an overview / batch helper and does not replace Order Details.
          </p>
          <button
            type="button"
            onClick={() => setShowBatchTools((v) => !v)}
            className="text-left text-xs font-semibold text-primary-700 underline"
          >
            {showBatchTools ? 'Hide optional legacy batch tools' : 'Show optional legacy batch tools (not required)'}
          </button>
          {showBatchTools ? (
          <>
          <p className="text-xs text-gray-500">
            Optional: select orders to create a batch parcel. Prefer Order Details for day-to-day courier entry.
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-xs font-semibold text-gray-600">Courier company
              <input value={courierCompany} onChange={(e) => setCourierCompany(e.target.value)} placeholder="Courier company" className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm font-normal" />
            </label>
            <label className="text-xs font-semibold text-gray-600">Scheduled pickup date (not actual dispatch)
              <input type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm font-normal" />
            </label>
            <label className="text-xs font-semibold text-gray-600">Actual handover date & time (IST)
              <input type="datetime-local" value={dispatchedAt} onChange={(e) => setDispatchedAt(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm font-normal" />
            </label>
            <label className="text-xs font-semibold text-gray-600">Tracking ID
              <input value={parcelTracking} onChange={(e) => setParcelTracking(e.target.value)} placeholder="Optional" className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm font-normal" />
            </label>
            <label className="text-xs font-semibold text-gray-600">Weight (kg)
              <input type="number" min="0" step="0.01" value={parcelWeight} onChange={(e) => setParcelWeight(e.target.value)} placeholder="Optional" className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm font-normal" />
            </label>
            <label className="text-xs font-semibold text-gray-600">Destination state
              <input value={destinationState} onChange={(e) => setDestinationState(e.target.value)} placeholder="Optional" className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm font-normal" />
            </label>
            <label className="text-xs font-semibold text-gray-600">Calculated courier cost
              <input type="number" min="0" step="0.01" value={calculatedCourierCost} onChange={(e) => setCalculatedCourierCost(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm font-normal" />
            </label>
            <label className="text-xs font-semibold text-gray-600">Manual courier cost override
              <input type="number" min="0" step="0.01" value={manualCourierCost} onChange={(e) => setManualCourierCost(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm font-normal" />
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" checked={confirmPickup} onChange={(e) => setConfirmPickup(e.target.checked)} />
              Record handover / dispatch now
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedIds(new Set(pageIds))}
              className="min-h-[44px] rounded-xl border px-3 py-2 text-sm font-semibold"
            >
              Select listed orders
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="min-h-[44px] rounded-xl border px-3 py-2 text-sm font-semibold"
            >
              Clear
            </button>
            <button
              type="button"
              disabled={batchBusy || !selectedIds.size}
              onClick={createBatch}
              className="min-h-[44px] rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {batchBusy ? 'Creating…' : `Create batch (${selectedIds.size})`}
            </button>
          </div>
          {batches.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-gray-600">
                    <th className="p-2">Batch</th>
                    <th className="p-2">Courier</th>
                    <th className="p-2">Parcels</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Orders</th>
                    <th className="p-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.slice(0, 10).map((b) => (
                    <tr key={b._id} className="border-t align-top">
                      <td className="p-2 font-semibold">{b.batchCode}</td>
                      <td className="p-2">{b.courierCompany || '—'}</td>
                      <td className="p-2">
                        <p>{b.parcelCount || (b.parcels || []).length || 0}</p>
                        <ul className="mt-1 space-y-1 text-[11px] text-gray-600">
                          {(b.parcels || []).map((p) => (
                            <li key={p._id || p.parcelCode} className="rounded border bg-gray-50 px-1.5 py-1">
                              {p.parcelCode}: {(p.orderNumbers || []).join(', ') || `${(p.orderIds || []).length} order(s)`}
                              <br />
                              AWB {p.trackingNumber || '—'} · {p.dispatchedAt ? formatIstDateTime(p.dispatchedAt) : 'pending'}
                              <br />
                              Wt {p.weightKg != null ? `${p.weightKg} kg` : '—'}
                              {' · '}{p.destinationState || '—'}
                              {' · '}Cost {p.manualCourierCost != null ? `₹${p.manualCourierCost}` : (p.calculatedCourierCost != null ? `₹${p.calculatedCourierCost}` : '—')}
                              {p.recordedByName ? ` · By ${p.recordedByName}` : ''}
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td className="p-2 capitalize">{String(b.status || '').replace(/_/g, ' ')}</td>
                      <td className="p-2 text-xs">{(b.orderNumbers || []).join(', ')}</td>
                      <td className="p-2 space-y-1">
                        {writable && b.status !== 'handed_over' && b.status !== 'completed' ? (
                          <button
                            type="button"
                            className="rounded border px-2 py-1 text-xs font-semibold"
                            onClick={async () => {
                              const handoverAt = dispatchedAt ? fromDatetimeLocalIst(dispatchedAt) : null;
                              if (!handoverAt) {
                                toast.error('Actual dispatch date/time is required for handover');
                                return;
                              }
                              const res = await fetch('/api/admin/ops/dispatch-batches', {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  batchId: b._id,
                                  confirmPickup: true,
                                  dispatchedAt: handoverAt.toISOString(),
                                }),
                              });
                              const data = await res.json().catch(() => ({}));
                              if (!res.ok) {
                                toast.error(data.error || 'Handover failed');
                                return;
                              }
                              toast.success('Courier handover recorded');
                              load(activeStatus);
                            }}
                          >
                            Confirm handover
                          </button>
                        ) : null}
                        {writable ? (
                          <button
                            type="button"
                            disabled={batchBusy || !selectedIds.size}
                            className="block rounded border px-2 py-1 text-xs font-semibold disabled:opacity-50"
                            onClick={() => addParcelToBatch(b._id)}
                          >
                            Add parcel with selected
                          </button>
                        ) : null}
                        {writable && (b.parcels || []).length ? (
                          <div className="space-y-1 pt-1">
                            {(b.parcels || []).map((p) => (
                              <button
                                key={`trk-${p._id || p.parcelCode}`}
                                type="button"
                                className="block rounded border px-2 py-1 text-[11px] font-semibold"
                                onClick={async () => {
                                  const next = window.prompt(`Update tracking for ${p.parcelCode} (dispatch date kept)`, p.trackingNumber || '');
                                  if (next == null) return;
                                  const res = await fetch('/api/admin/ops/dispatch-batches', {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      batchId: b._id,
                                      action: 'update_tracking',
                                      parcelId: p._id,
                                      trackingNumber: next,
                                    }),
                                  });
                                  const data = await res.json().catch(() => ({}));
                                  if (!res.ok) {
                                    toast.error(data.error || 'Tracking update failed');
                                    return;
                                  }
                                  toast.success('Tracking updated · dispatch date preserved');
                                  load(activeStatus);
                                }}
                              >
                                Edit AWB {p.parcelCode}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          </>
          ) : (
            <p className="text-xs text-gray-500">
              Use Order Details → Courier &amp; Dispatch for parcel entry. Historical batches remain visible when you expand batch tools.
            </p>
          )}
        </div>
      ) : null}

      <div className="rounded-xl border bg-white overflow-hidden">
        <div className="border-b bg-gray-50 px-4 py-3 font-bold">
          {activeStatus === 'delayed' ? 'Delayed orders' : activeStatus ? OPS_STATUS_LABELS[activeStatus] : 'Orders in view'}
        </div>
        {loading ? <p className="p-6 text-center text-sm">Loading…</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-gray-600">
                  <th className="p-3 w-10" />
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
                {(board?.orders || []).map((order) => {
                  const id = String(order._id);
                  return (
                    <tr key={order._id} className="border-t">
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(id)}
                          onChange={(e) => {
                            setSelectedIds((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(id);
                              else next.delete(id);
                              return next;
                            });
                          }}
                        />
                      </td>
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
                  );
                })}
                {!board?.orders?.length ? (
                  <tr><td colSpan={8} className="p-6 text-center text-gray-500">No orders in this view.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {writable ? (
        <div className="rounded-xl border bg-white p-4 space-y-3">
          <h2 className="font-bold">Create task</h2>
          <p className="text-xs text-gray-500">
            Extra internal work only (follow-ups, corrections, packing issues). Does not replace automatic Editor assignment or the normal order workflow.
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <input
              value={taskForm.orderNumber}
              onChange={(e) => setTaskForm((f) => ({ ...f, orderNumber: e.target.value }))}
              placeholder="Order ID optional (G4746 / GG…)"
              className="rounded-xl border px-3 py-2.5 text-sm"
            />
            <select
              value={taskForm.type}
              onChange={(e) => setTaskForm((f) => ({ ...f, type: e.target.value }))}
              className="rounded-xl border px-3 py-2.5 text-sm capitalize"
            >
              {TASK_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select
              value={taskForm.priority}
              onChange={(e) => setTaskForm((f) => ({ ...f, priority: e.target.value }))}
              className="rounded-xl border px-3 py-2.5 text-sm"
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
            <input
              value={taskForm.title}
              onChange={(e) => setTaskForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Task title (optional)"
              className="rounded-xl border px-3 py-2.5 text-sm"
            />
            <select
              value={taskForm.assignedTo}
              onChange={(e) => setTaskForm((f) => ({ ...f, assignedTo: e.target.value }))}
              className="rounded-xl border px-3 py-2.5 text-sm"
            >
              <option value="">Unassigned</option>
              {staff.map((a) => (
                <option key={a._id || a.id} value={a._id || a.id}>{a.name || a.email}</option>
              ))}
            </select>
            <input
              type="datetime-local"
              value={taskForm.dueDate}
              onChange={(e) => setTaskForm((f) => ({ ...f, dueDate: e.target.value }))}
              className="rounded-xl border px-3 py-2.5 text-sm"
            />
          </div>
          <textarea
            value={taskForm.notes}
            onChange={(e) => setTaskForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Notes"
            rows={2}
            className="w-full rounded-xl border px-3 py-2.5 text-sm"
          />
          <button
            type="button"
            disabled={taskBusy}
            onClick={createTask}
            className="min-h-[44px] rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {taskBusy ? 'Creating…' : 'Create task'}
          </button>
        </div>
      ) : null}

      <div className="rounded-xl border bg-white p-4 space-y-4">
        <div className="mb-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-bold">Work planner</h2>
          <div className="flex flex-wrap gap-2">
            {[
              ['today', "Today's Work"],
              ['tomorrow', "Tomorrow's Work"],
              ['week', 'Upcoming 7 Days'],
              ['overdue', 'Overdue'],
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
        <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-3">
          <h3 className="mb-1 text-sm font-bold text-sky-950">Order workflow workload (live orders)</h3>
          <p className="mb-2 text-[11px] text-sky-900">
            Same Editor pending-editing counts used by automatic Editor assignment. Board status chips above cover printing / production / packing / dispatch.
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {(editorWorkload || []).length ? editorWorkload.map((ed) => (
              <div key={ed.id || ed._id} className="rounded-lg border bg-white px-3 py-2 text-xs">
                <p className="font-semibold">{ed.name || ed.email || 'Editor'}</p>
                <p className="text-gray-600">
                  Pending editing: <strong>{ed.pendingEditing ?? ed.pending ?? 0}</strong>
                </p>
              </div>
            )) : (
              <p className="text-xs text-gray-500 sm:col-span-3">No active Editors / workload data.</p>
            )}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            {[
              ['editing_in_progress', 'Editing'],
              ['printing_in_progress', 'Printing'],
              ['production_in_progress', 'Production'],
              ['packing_pending', 'Packing'],
              ['ready_to_dispatch', 'Dispatch ready'],
              ['dispatched', 'Dispatched'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveStatus(key)}
                className="rounded-lg border bg-white px-2 py-1.5 text-left"
              >
                <p className="font-semibold text-gray-700">{label}</p>
                <p className="text-lg font-bold">{counts[key] || 0}</p>
              </button>
            ))}
            <div className="rounded-lg border border-red-100 bg-red-50 px-2 py-1.5">
              <p className="font-semibold text-red-700">Overdue</p>
              <p className="text-lg font-bold text-red-800">{counts.delayed || 0}</p>
            </div>
            <div className="rounded-lg border border-amber-100 bg-amber-50 px-2 py-1.5">
              <p className="font-semibold text-amber-800">Due today</p>
              <p className="text-lg font-bold text-amber-900">{board?.alerts?.dueToday || 0}</p>
            </div>
          </div>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-bold text-gray-900">Additional internal tasks (Create Task)</h3>
          <p className="mb-2 text-[11px] text-gray-500">
            Distinct from order workflow. Optional Order ID. Does not drive Editor assignment.
          </p>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {TASK_TYPES.map((type) => {
            const rows = tasks.filter((t) => t.type === type);
            return (
              <div key={type} className="rounded-xl border bg-gray-50 p-3">
                <h3 className="mb-2 text-sm font-bold capitalize">{type}</h3>
                {rows.length ? rows.map((task) => (
                  <div key={task._id} className="mb-2 rounded-lg border bg-white p-2 text-xs">
                    <p className="font-semibold">{task.title}</p>
                    <p className="text-gray-600">{task.orderNumber || 'No order link'} · {task.status} · {task.priority}</p>
                    {task.dueDate ? <p className="text-gray-500">Due {new Date(task.dueDate).toLocaleString('en-IN')}</p> : null}
                    {writable && task.status !== 'completed' ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {task.status !== 'in_progress' ? (
                          <button
                            type="button"
                            className="rounded border px-2 py-0.5 font-semibold"
                            onClick={async () => {
                              const res = await fetch('/api/admin/ops/tasks', {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ taskId: task._id, status: 'in_progress' }),
                              });
                              if (!res.ok) {
                                const data = await res.json().catch(() => ({}));
                                toast.error(data.error || 'Update failed');
                                return;
                              }
                              load(activeStatus);
                            }}
                          >
                            Start
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="rounded border border-green-200 bg-green-50 px-2 py-0.5 font-semibold text-green-900"
                          onClick={async () => {
                            const res = await fetch('/api/admin/ops/tasks', {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ taskId: task._id, status: 'completed' }),
                            });
                            if (!res.ok) {
                              const data = await res.json().catch(() => ({}));
                              toast.error(data.error || 'Update failed');
                              return;
                            }
                            toast.success('Task completed');
                            load(activeStatus);
                          }}
                        >
                          Done
                        </button>
                        <select
                          className="rounded border px-1 py-0.5"
                          defaultValue=""
                          onChange={async (e) => {
                            const assignedTo = e.target.value;
                            e.target.value = '';
                            if (!assignedTo) return;
                            const res = await fetch('/api/admin/ops/tasks', {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ taskId: task._id, assignedTo }),
                            });
                            if (!res.ok) {
                              const data = await res.json().catch(() => ({}));
                              toast.error(data.error || 'Reassign failed');
                              return;
                            }
                            toast.success('Task reassigned');
                            load(activeStatus);
                          }}
                        >
                          <option value="">Reassign…</option>
                          {staff.map((a) => (
                            <option key={a._id || a.id} value={a._id || a.id}>{a.name || a.email}</option>
                          ))}
                        </select>
                      </div>
                    ) : null}
                  </div>
                )) : <p className="text-xs text-gray-500">No tasks</p>}
              </div>
            );
          })}
        </div>
        </div>
      </div>
    </div>
  );
}
