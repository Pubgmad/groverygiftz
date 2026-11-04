'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { formatPrice } from '@/lib/utils';
import {
  OPS_STATUSES,
  OPS_STATUS_LABELS,
  DESIGN_APPROVAL_LABELS,
  canPrintDesign,
} from '@/lib/opsConstants';

export default function OrderOpsPanel({ order, writable, onUpdated }) {
  const [opsStatus, setOpsStatus] = useState(order?.opsStatus || 'new_order');
  const [staff, setStaff] = useState([]);
  const [assignedTo, setAssignedTo] = useState(order?.assignedTo ? String(order.assignedTo) : '');
  const [expectedDispatchDate, setExpectedDispatchDate] = useState(
    order?.expectedDispatchDate ? String(order.expectedDispatchDate).slice(0, 10) : '',
  );
  const [busy, setBusy] = useState(false);
  const [pay, setPay] = useState({
    amount: '',
    kind: 'advance',
    method: 'UPI',
    reference: '',
    verified: false,
    notes: '',
  });
  const [revisionCharge, setRevisionCharge] = useState('');
  const [courierCompany, setCourierCompany] = useState(order?.courierCompany || '');
  const [trackingUrl, setTrackingUrl] = useState(order?.trackingUrl || '');

  useEffect(() => {
    setOpsStatus(order?.opsStatus || 'new_order');
    setAssignedTo(order?.assignedTo ? String(order.assignedTo) : '');
    setExpectedDispatchDate(order?.expectedDispatchDate ? String(order.expectedDispatchDate).slice(0, 10) : '');
    setCourierCompany(order?.courierCompany || '');
    setTrackingUrl(order?.trackingUrl || '');
  }, [order?._id, order?.opsStatus, order?.assignedTo, order?.expectedDispatchDate, order?.courierCompany, order?.trackingUrl]);

  useEffect(() => {
    fetch('/api/admin/staff', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { staff: [] }))
      .then((d) => setStaff(d.staff || []))
      .catch(() => setStaff([]));
  }, []);

  const refresh = async () => {
    if (onUpdated) await onUpdated();
  };

  const patchOps = async (payload) => {
    if (!writable) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/orders/${order._id}/ops`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');
      toast.success('Operations updated');
      await refresh();
    } catch (err) {
      toast.error(err.message || 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  const recordPayment = async (override = {}) => {
    if (!writable) return;
    const amount = Number(override.amount ?? pay.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    setBusy(true);
    try {
      const body = new FormData();
      body.append('amount', String(amount));
      body.append('kind', override.kind || pay.kind);
      body.append('method', override.method || pay.method);
      body.append('reference', override.reference || pay.reference);
      body.append('notes', override.notes || pay.notes);
      body.append('verified', String(Boolean(override.verified ?? pay.verified)));
      if (override.file) body.append('screenshot', override.file);
      const res = await fetch(`/api/admin/orders/${order._id}/payments`, { method: 'POST', body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Payment failed');
      toast.success(`Payment recorded · balance ${data.balanceStatus}`);
      setPay((p) => ({ ...p, amount: '', reference: '', notes: '' }));
      await refresh();
    } catch (err) {
      toast.error(err.message || 'Payment failed');
    } finally {
      setBusy(false);
    }
  };

  const printOk = canPrintDesign(order);
  const freeRevisionUsed = Boolean(order.freeRevisionUsed);
  const revisionCount = Number(order.designRevisionCount || 0);

  return (
    <div className="space-y-3">
      <div className="rounded-xl border bg-gray-50 p-3 space-y-2">
        <h3 className="font-semibold text-gray-900">Operations workflow</h3>
        <label className="block text-xs font-semibold text-gray-600">
          Ops status
          <select
            disabled={!writable || busy}
            value={opsStatus}
            onChange={(e) => setOpsStatus(e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm disabled:bg-gray-100"
          >
            {OPS_STATUSES.map((s) => (
              <option key={s} value={s}>{OPS_STATUS_LABELS[s] || s}</option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-semibold text-gray-600">
          Assign employee
          <select
            disabled={!writable || busy}
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm disabled:bg-gray-100"
          >
            <option value="">Unassigned</option>
            {staff.map((a) => (
              <option key={a._id || a.id} value={a._id || a.id}>{a.name || a.email}</option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-semibold text-gray-600">
          Expected dispatch
          <input
            type="date"
            disabled={!writable || busy}
            value={expectedDispatchDate}
            onChange={(e) => setExpectedDispatchDate(e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm disabled:bg-gray-100"
          />
        </label>
        {writable ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => patchOps({
              opsStatus,
              assignedTo: assignedTo || null,
              expectedDispatchDate: expectedDispatchDate || null,
              courierCompany,
              trackingUrl,
            })}
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            Save ops updates
          </button>
        ) : null}
        {writable ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {[
              ['editing_in_progress', 'Start editing'],
              ['preview_waiting', 'Send to preview'],
              ['printing_assigned', 'Assign printing'],
              ['printing_in_progress', 'Start printing'],
              ['printing_completed', 'Printing done'],
              ['production_in_progress', 'Start production'],
              ['manufacturing', 'Manufacturing'],
              ['assembly', 'Assembly'],
              ['finishing', 'Finishing'],
              ['quality_check', 'Quality check'],
              ['packing_pending', 'To packing'],
              ['ready_to_dispatch', 'Ready to dispatch'],
            ].map(([status, label]) => (
              <button
                key={status}
                type="button"
                disabled={busy || opsStatus === status}
                onClick={() => {
                  setOpsStatus(status);
                  patchOps({
                    opsStatus: status,
                    assignedTo: assignedTo || null,
                    expectedDispatchDate: expectedDispatchDate || null,
                    courierCompany,
                    trackingUrl,
                    notes: `Quick action: ${label}`,
                  });
                }}
                className="rounded-lg border bg-white px-2.5 py-1.5 text-[11px] font-semibold text-gray-800 disabled:opacity-40"
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}
        <p className={`text-xs font-semibold ${printOk ? 'text-green-700' : 'text-amber-700'}`}>
          Design print eligibility: {printOk ? 'Allowed' : 'Blocked until design approved (if preview required)'}
        </p>
        <p className="text-xs text-gray-500">
          Design status: {DESIGN_APPROVAL_LABELS[order.designApprovalStatus] || 'Not Uploaded'}
          {order.currentDesignVersion ? ` · v${order.currentDesignVersion}` : ''}
        </p>
      </div>

      <div className="rounded-xl border bg-white p-3 space-y-2">
        <h3 className="font-semibold text-gray-900">Payments & balance</h3>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <p>Total: <strong>{formatPrice(order.total || 0)}</strong></p>
          <p>Advance: <strong>{formatPrice(order.advancePaid || 0)}</strong></p>
          <p>Balance paid: <strong>{formatPrice(order.balancePaid || 0)}</strong></p>
          <p>Remaining: <strong>{formatPrice(order.remainingBalance || 0)}</strong></p>
          <p className="col-span-2">Status: <strong>{order.balanceStatus || order.paymentStatus || '—'}</strong></p>
        </div>
        {writable ? (
          <div className="space-y-2 border-t pt-2">
            <div className="grid gap-2 sm:grid-cols-2">
              <input type="number" min="0" step="0.01" placeholder="Amount" value={pay.amount} onChange={(e) => setPay((p) => ({ ...p, amount: e.target.value }))} className="rounded-lg border px-3 py-2 text-sm" />
              <select value={pay.kind} onChange={(e) => setPay((p) => ({ ...p, kind: e.target.value }))} className="rounded-lg border px-3 py-2 text-sm">
                <option value="advance">Advance</option>
                <option value="balance">Balance</option>
                <option value="revision">Revision charge</option>
                <option value="other">Other</option>
              </select>
              <input placeholder="Method" value={pay.method} onChange={(e) => setPay((p) => ({ ...p, method: e.target.value }))} className="rounded-lg border px-3 py-2 text-sm" />
              <input placeholder="Reference" value={pay.reference} onChange={(e) => setPay((p) => ({ ...p, reference: e.target.value }))} className="rounded-lg border px-3 py-2 text-sm" />
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold">
              <input type="checkbox" checked={pay.verified} onChange={(e) => setPay((p) => ({ ...p, verified: e.target.checked }))} />
              Mark verified (screenshot alone does not verify)
            </label>
            <input
              type="file"
              accept="image/*,application/pdf"
              className="block w-full text-xs"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                recordPayment({ file });
              }}
            />
            <button type="button" disabled={busy} onClick={() => recordPayment()} className="min-h-[44px] w-full rounded-xl border px-3 py-2 text-sm font-semibold disabled:opacity-60">
              Record payment
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => patchOps({ paymentException: true, paymentExceptionNote: 'Authorized dispatch exception' })}
              className="min-h-[40px] w-full rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900"
            >
              Grant payment exception for dispatch
            </button>
          </div>
        ) : null}
        {Array.isArray(order.paymentRecords) && order.paymentRecords.length > 0 ? (
          <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-gray-600">
            {order.paymentRecords.slice().reverse().map((row, idx) => (
              <li key={row._id || idx} className="rounded border bg-gray-50 px-2 py-1">
                {row.kind} {formatPrice(row.amount)} · {row.method || '—'} · {row.verified ? 'verified' : 'unverified'}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="rounded-xl border bg-white p-3 space-y-2">
        <h3 className="font-semibold text-gray-900">Revisions</h3>
        <p className="text-xs text-gray-600">
          Policy: first revision free. Used free: {freeRevisionUsed ? 'Yes' : 'No'} · Requests: {revisionCount}
          {Number(order.revisionCharges) > 0 ? ` · Charges: ${formatPrice(order.revisionCharges)}` : ''}
          {order.revisionPaymentVerified ? ' · Charge verified' : ''}
        </p>
        {writable && freeRevisionUsed ? (
          <div className="flex gap-2">
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Paid revision amount"
              value={revisionCharge}
              onChange={(e) => setRevisionCharge(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => recordPayment({ amount: revisionCharge, kind: 'revision', verified: true, notes: 'Chargeable revision' })}
              className="rounded-xl border px-3 py-2 text-xs font-semibold"
            >
              Record charge
            </button>
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border bg-white p-3 space-y-2">
        <h3 className="font-semibold text-gray-900">Tracking & courier</h3>
        <input
          disabled={!writable || busy}
          placeholder="Courier company"
          value={courierCompany}
          onChange={(e) => setCourierCompany(e.target.value)}
          className="w-full rounded-lg border px-3 py-2 text-sm disabled:bg-gray-100"
        />
        <input
          disabled={!writable || busy}
          placeholder="Tracking URL"
          value={trackingUrl}
          onChange={(e) => setTrackingUrl(e.target.value)}
          className="w-full rounded-lg border px-3 py-2 text-sm disabled:bg-gray-100"
        />
      </div>

      <div className="rounded-xl border bg-white p-3 space-y-2">
        <h3 className="font-semibold text-gray-900">Production video</h3>
        {writable ? (
          <input
            type="file"
            accept="video/*"
            disabled={busy}
            className="block w-full text-xs"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              setBusy(true);
              try {
                const body = new FormData();
                body.append('file', file);
                const res = await fetch(`/api/admin/orders/${order._id}/production-video`, { method: 'POST', body });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Upload failed');
                toast.success('Production video uploaded');
                await refresh();
              } catch (err) {
                toast.error(err.message || 'Upload failed');
              } finally {
                setBusy(false);
              }
            }}
          />
        ) : null}
        {(order.productionVideos || []).map((vid, idx) => (
          <div key={vid._id || idx} className="flex flex-wrap items-center gap-2 text-xs">
            <a href={vid.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary-700 underline">
              Video {idx + 1}{vid.uploadedAt ? ` · ${new Date(vid.uploadedAt).toLocaleString('en-IN')}` : ''}
            </a>
            {writable ? (
              <button
                type="button"
                className="rounded border border-green-200 bg-green-50 px-2 py-1 font-semibold text-green-900"
                onClick={async () => {
                  try {
                    const res = await fetch(`/api/admin/orders/${order._id}/production-video?videoId=${encodeURIComponent(vid._id || '')}`);
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || 'Share failed');
                    if (data.whatsappShareUrl) window.open(data.whatsappShareUrl, '_blank', 'noopener,noreferrer');
                    toast.success('WhatsApp opened with video link');
                  } catch (err) {
                    toast.error(err.message || 'Share failed');
                  }
                }}
              >
                Share on WhatsApp
              </button>
            ) : null}
          </div>
        ))}
      </div>

      {Array.isArray(order.photoHistory) && order.photoHistory.length > 0 ? (
        <div className="rounded-xl border bg-white p-3 space-y-2">
          <h3 className="font-semibold text-gray-900">Photo version history</h3>
          <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-gray-600">
            {order.photoHistory.slice().reverse().map((row, idx) => (
              <li key={row._id || idx} className="rounded border bg-gray-50 px-2 py-1">
                {row.slotKey || 'photo'} · {row.replacedAt ? new Date(row.replacedAt).toLocaleString('en-IN') : ''}
                {row.previousPath ? (
                  <a className="ml-2 underline text-primary-700" href={row.previousPath.startsWith('/') ? row.previousPath : `/media/${row.previousPath}`} target="_blank" rel="noopener noreferrer">previous</a>
                ) : null}
                {row.newPath ? (
                  <a className="ml-2 underline text-primary-700" href={`/media/${row.newPath}`} target="_blank" rel="noopener noreferrer">new</a>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="rounded-xl border bg-white p-3 space-y-2">
        <h3 className="font-semibold text-gray-900">Replace customer photo</h3>
        <p className="text-[11px] text-gray-500">Blocked after printing starts. Originals are preserved in history.</p>
        {writable ? (
          <input
            type="file"
            accept="image/*"
            disabled={busy}
            className="block w-full text-xs"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              const reason = window.prompt('Replacement reason') || '';
              setBusy(true);
              try {
                const body = new FormData();
                body.append('file', file);
                body.append('itemIndex', '0');
                body.append('slotKey', 'item-0');
                body.append('reason', reason);
                const res = await fetch(`/api/admin/orders/${order._id}/photos`, { method: 'POST', body });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Replace failed');
                toast.success('Photo replaced');
                await refresh();
              } catch (err) {
                toast.error(err.message || 'Replace failed');
              } finally {
                setBusy(false);
              }
            }}
          />
        ) : null}
      </div>

      {Array.isArray(order.timeline) && order.timeline.length > 0 ? (
        <div className="rounded-xl border bg-gray-50 p-3">
          <h3 className="mb-2 font-semibold text-gray-900">Order timeline</h3>
          <ul className="max-h-48 space-y-1 overflow-y-auto text-xs text-gray-600">
            {order.timeline.slice().reverse().slice(0, 30).map((ev, idx) => (
              <li key={ev._id || idx} className="rounded border bg-white px-2 py-1">
                <span className="font-semibold">{ev.type}</span>
                {ev.newStatus ? ` → ${ev.newStatus}` : ''}
                {ev.notes ? ` · ${ev.notes}` : ''}
                <span className="block text-[10px] text-gray-400">{ev.at ? new Date(ev.at).toLocaleString('en-IN') : ''}{ev.employeeName ? ` · ${ev.employeeName}` : ''}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
