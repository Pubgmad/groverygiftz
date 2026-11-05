'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { formatPrice } from '@/lib/utils';
import { formatIstDateTime, fromDatetimeLocalIst, toDatetimeLocalIst } from '@/lib/istTime';
import {
  OPS_STATUS_LABELS,
  DESIGN_APPROVAL_LABELS,
  SALES_COMMS_KEYS,
  SALES_COMMS_LABELS,
  canPrintDesign,
  canTransitionOpsStatus,
  allowedOpsStatusesFor,
  requiresPaidRevisionGate,
  PRINTING_STARTED_OPS,
} from '@/lib/opsConstants';

function assetListFromItem(item) {
  const out = [];
  const fields = item?.customFields;
  if (fields && typeof fields === 'object') {
    Object.entries(fields).forEach(([label, value]) => {
      if (label === 'Variant Label Uploads' && value && typeof value === 'object') {
        Object.entries(value).forEach(([vk, vv]) => {
          const url = typeof vv === 'string' ? vv : (vv?.url || vv?.displayUrl || '');
          if (url) out.push({ label: `${label}: ${vk}`, url, fieldPath: `customFields.Variant Label Uploads.${vk}` });
        });
      } else if (Array.isArray(value)) {
        value.forEach((entry, idx) => {
          const url = typeof entry === 'string' ? entry : (entry?.url || entry?.displayUrl || '');
          if (url) out.push({ label: `${label} #${idx + 1}`, url, fieldPath: `customFields.${label}.${idx}` });
        });
      } else {
        const url = typeof value === 'string' ? value : (value?.url || value?.displayUrl || '');
        if (url && (/\.(png|jpe?g|webp|gif)/i.test(url) || url.includes('/media/') || url.includes('/api/customization'))) {
          out.push({ label, url, fieldPath: `customFields.${label}` });
        }
      }
    });
  }
  (item?.collageUploads || []).forEach((group, g) => {
    (group?.images || []).forEach((img, idx) => {
      const url = typeof img === 'string' ? img : (img?.url || img?.displayUrl || '');
      if (url) out.push({ label: `${group.label || `Collage ${g + 1}`} #${idx + 1}`, url, fieldPath: `collageUploads.${g}.images.${idx}` });
    });
  });
  return out;
}

export default function OrderOpsPanel({ order, writable, onUpdated }) {
  const [opsStatus, setOpsStatus] = useState(order?.opsStatus || 'new_order');
  const [staff, setStaff] = useState([]);
  const [assignedTo, setAssignedTo] = useState(order?.assignedTo ? String(order.assignedTo) : '');
  const [printingAssignedTo, setPrintingAssignedTo] = useState(
    order?.printingAssignedTo ? String(order.printingAssignedTo) : '',
  );
  const toYmdIst = (value) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
    return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, '0')}-${String(ist.getUTCDate()).padStart(2, '0')}`;
  };
  const [expectedDispatchDate, setExpectedDispatchDate] = useState(
    () => toYmdIst(order?.expectedDispatchDate),
  );
  const [busy, setBusy] = useState(false);
  const [pay, setPay] = useState({
    amount: '',
    kind: 'advance',
    method: 'UPI',
    reference: '',
    verified: false,
    notes: '',
    paidAt: toDatetimeLocalIst(new Date()),
  });
  const [revisionCharge, setRevisionCharge] = useState('');
  const [courierCompany, setCourierCompany] = useState(order?.courierCompany || '');
  const [trackingUrl, setTrackingUrl] = useState(order?.trackingUrl || '');
  const [photoItemIndex, setPhotoItemIndex] = useState(0);
  const [photoSlot, setPhotoSlot] = useState('');
  const [comms, setComms] = useState(order?.salesCommsChecklist || {});

  useEffect(() => {
    setOpsStatus(order?.opsStatus || 'new_order');
    setAssignedTo(order?.assignedTo ? String(order.assignedTo) : '');
    setPrintingAssignedTo(order?.printingAssignedTo ? String(order.printingAssignedTo) : '');
    setExpectedDispatchDate(toYmdIst(order?.expectedDispatchDate));
    setCourierCompany(order?.courierCompany || '');
    setTrackingUrl(order?.trackingUrl || '');
    setComms(order?.salesCommsChecklist || {});
  }, [
    order?._id,
    order?.opsStatus,
    order?.assignedTo,
    order?.printingAssignedTo,
    order?.expectedDispatchDate,
    order?.courierCompany,
    order?.trackingUrl,
    order?.salesCommsChecklist,
  ]);

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
      const paidAtLocal = override.paidAt || pay.paidAt;
      const paidAtDate = paidAtLocal ? fromDatetimeLocalIst(paidAtLocal) : null;
      if (!paidAtDate) {
        throw new Error('Actual payment date/time is required');
      }
      body.append('paidAt', paidAtDate.toISOString());
      if (override.file) body.append('screenshot', override.file);
      const res = await fetch(`/api/admin/orders/${order._id}/payments`, { method: 'POST', body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Payment failed');
      toast.success(`Payment recorded · balance ${data.balanceStatus}`);
      setPay((p) => ({ ...p, amount: '', reference: '', notes: '', paidAt: toDatetimeLocalIst(new Date()) }));
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
  const paidRevisionBlocked = requiresPaidRevisionGate(order);
  const printingLocked = PRINTING_STARTED_OPS.has(order?.opsStatus) || Boolean(order?.printingStartedAt);
  const currentOps = order?.opsStatus || 'new_order';
  const allowedStatuses = allowedOpsStatusesFor(currentOps);
  const items = Array.isArray(order?.items) ? order.items : [];
  const selectedItemPhotos = useMemo(
    () => assetListFromItem(items[photoItemIndex] || {}),
    [items, photoItemIndex],
  );

  const quickActions = [
    ['editing_in_progress', 'Start editing'],
    ['preview_waiting', 'Send to preview'],
    ['printing_assigned', 'Assign printing'],
    ['printing_in_progress', 'Start printing'],
    ['printing_completed', 'Printing done'],
    ['production_pending', 'Production pending'],
    ['production_in_progress', 'Start production'],
    ['manufacturing', 'Manufacturing'],
    ['assembly', 'Assembly'],
    ['finishing', 'Finishing'],
    ['quality_check', 'Quality check'],
    ['packing_pending', 'To packing'],
    ['ready_to_dispatch', 'Ready to dispatch'],
    ['tracking_pending', 'Tracking pending'],
    ['completed', 'Complete'],
    ['on_hold', 'On hold'],
  ].filter(([status]) => canTransitionOpsStatus(currentOps, status) && status !== currentOps);

  const toggleComm = async (key, done) => {
    const next = {
      ...(comms || {}),
      [key]: { done, note: comms?.[key]?.note || '' },
    };
    setComms(next);
    await patchOps({ salesCommsChecklist: { [key]: { done } } });
  };

  return (
    <div className="space-y-3">
      {paidRevisionBlocked ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          <p className="font-bold">Paid revision required</p>
          <p className="text-xs mt-1">
            Free revision already used ({revisionCount} request(s)). Record and verify a revision charge before uploading a new design or starting print/production.
          </p>
        </div>
      ) : null}

      <div className="rounded-xl border bg-gray-50 p-3 space-y-2">
        <h3 className="font-semibold text-gray-900">Operations workflow</h3>
        <label className="block text-xs font-semibold text-gray-600">
          Ops status
          <select
            disabled={!writable || busy}
            value={allowedStatuses.includes(opsStatus) ? opsStatus : currentOps}
            onChange={(e) => setOpsStatus(e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm disabled:bg-gray-100"
          >
            {allowedStatuses.map((s) => (
              <option key={s} value={s}>{OPS_STATUS_LABELS[s] || s}</option>
            ))}
          </select>
        </label>
        <p className="text-[11px] text-gray-500">Only valid next statuses are listed (server also enforces transitions).</p>
        <label className="block text-xs font-semibold text-gray-600">
          Assigned Editor
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
        {!assignedTo ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] font-semibold text-amber-950">
            Assignment warning: no Editor assigned. New Website/WhatsApp orders auto-assign to the Editor with the lowest pending editing workload when Editors are active.
          </p>
        ) : (
          <p className="text-[11px] text-gray-500">
            Current Editor: {order?.assignedToName || '—'} (manual reassignment available for Super Admin)
          </p>
        )}
        {Array.isArray(order?.assignmentHistory) && order.assignmentHistory.length > 0 ? (
          <details className="text-[11px] text-gray-600">
            <summary className="cursor-pointer font-semibold">Assignment history</summary>
            <ul className="mt-1 max-h-28 space-y-1 overflow-y-auto">
              {order.assignmentHistory.slice().reverse().slice(0, 8).map((row, idx) => (
                <li key={row._id || idx} className="rounded border bg-white px-2 py-1">
                  {row.action || 'update'}
                  {row.newAssigneeName ? ` → ${row.newAssigneeName}` : ' → unassigned'}
                  {row.changedByName ? ` · by ${row.changedByName}` : ''}
                  {row.at ? ` · ${new Date(row.at).toLocaleString('en-IN')}` : ''}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
        <label className="block text-xs font-semibold text-gray-600">
          Printing assigned to
          <select
            disabled={!writable || busy}
            value={printingAssignedTo}
            onChange={(e) => setPrintingAssignedTo(e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm disabled:bg-gray-100"
          >
            <option value="">Unassigned</option>
            {staff.map((a) => (
              <option key={`print-${a._id || a.id}`} value={a._id || a.id}>{a.name || a.email}</option>
            ))}
          </select>
        </label>
        {order?.printingAssignedToName ? (
          <p className="text-[11px] text-gray-500">Current printer: {order.printingAssignedToName}</p>
        ) : null}
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
            onClick={() => {
              const payload = {
                opsStatus,
                assignedTo: assignedTo || null,
                printingAssignedTo: printingAssignedTo || null,
                expectedDispatchDate: expectedDispatchDate || null,
              };
              // Only send tracking/courier when staff actually entered values
              // (avoids marking every ops save as a tracking touch)
              if (String(courierCompany || '').trim()) payload.courierCompany = courierCompany.trim();
              if (String(trackingUrl || '').trim()) payload.trackingUrl = trackingUrl.trim();
              return patchOps(payload);
            }}
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            Save ops updates
          </button>
        ) : null}
        {writable && quickActions.length ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {quickActions.map(([status, label]) => (
              <button
                key={status}
                type="button"
                disabled={busy}
                onClick={() => {
                  setOpsStatus(status);
                  patchOps({
                    opsStatus: status,
                    assignedTo: assignedTo || null,
                    printingAssignedTo: printingAssignedTo || null,
                    expectedDispatchDate: expectedDispatchDate || null,
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
        <h3 className="font-semibold text-gray-900">Sales communication checklist</h3>
        <p className="text-[11px] text-gray-500">
          Customer chat stays in WhatsApp. Tick items after you actually send/confirm — opening WhatsApp alone does not mark delivery.
        </p>
        <ul className="space-y-2">
          {SALES_COMMS_KEYS.map((key) => {
            const row = comms?.[key] || {};
            return (
              <li key={key} className="flex items-start gap-2 text-xs">
                <input
                  type="checkbox"
                  disabled={!writable || busy}
                  checked={Boolean(row.done)}
                  onChange={(e) => toggleComm(key, e.target.checked)}
                  className="mt-0.5"
                />
                <div>
                  <p className="font-semibold text-gray-800">{SALES_COMMS_LABELS[key] || key}</p>
                  {row.done && row.at ? (
                    <p className="text-[10px] text-gray-500">
                      {new Date(row.at).toLocaleString('en-IN')}
                      {row.byName ? ` · ${row.byName}` : ''}
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="rounded-xl border bg-white p-3 space-y-2">
        <h3 className="font-semibold text-gray-900">
          {order?.orderSource === 'website' ? 'Website Cashfree payment' : 'WhatsApp payments & balance'}
        </h3>
        {order?.orderSource === 'website' ? (
          <div className="space-y-2 text-xs">
            <p>Total paid (Cashfree): <strong>{formatPrice(order.total || 0)}</strong></p>
            <p>Payment status: <strong>{order.paymentStatus || '—'}</strong></p>
            <p>Method: <strong>{order.paymentMethod || 'Cashfree'}</strong></p>
            {order.cashfreePaymentId || order.cashfreeOrderId ? (
              <p className="text-gray-600">
                Cashfree ref: {order.cashfreePaymentId || order.cashfreeOrderId}
              </p>
            ) : null}
            <p className="rounded-lg border border-sky-100 bg-sky-50 px-2 py-1.5 text-[11px] text-sky-950">
              Website orders use Cashfree only. Manual Advance / Balance recording is for WhatsApp orders.
            </p>
            {Array.isArray(order.paymentRecords) && order.paymentRecords.length > 0 ? (
              <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-gray-600">
                {order.paymentRecords.slice().reverse().map((row, idx) => (
                  <li key={row._id || idx} className="rounded border bg-gray-50 px-2 py-1.5">
                    Website Cashfree · {formatPrice(row.amount)}
                    {row.paidAt ? ` · ${formatIstDateTime(row.paidAt)}` : ''}
                    {row.reference ? ` · ${row.reference}` : ''}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
        <>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <p>Overall order amount: <strong>{formatPrice(order.total || 0)}</strong></p>
          <p>Advance (verified): <strong>{formatPrice(order.advancePaid || 0)}</strong></p>
          <p>Balance paid (verified): <strong>{formatPrice(order.balancePaid || 0)}</strong></p>
          <p>Remaining balance: <strong>{formatPrice(order.remainingBalance || 0)}</strong></p>
          <p className="col-span-2">Status: <strong>{order.balanceStatus || order.paymentStatus || '—'}</strong></p>
          {Number(order.revisionCharges) > 0 ? (
            <p className="col-span-2">Revision charges: <strong>{formatPrice(order.revisionCharges)}</strong>
              {order.revisionPaymentVerified ? ' · verified' : ' · awaiting verification'}
            </p>
          ) : null}
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
              <label className="sm:col-span-2 text-xs font-semibold text-gray-700">
                Payment date & time (IST) — actual receipt date, not verification date
                <input
                  type="datetime-local"
                  value={pay.paidAt}
                  onChange={(e) => setPay((p) => ({ ...p, paidAt: e.target.value }))}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm font-normal"
                />
              </label>
              <input
                placeholder="Notes (optional)"
                value={pay.notes}
                onChange={(e) => setPay((p) => ({ ...p, notes: e.target.value }))}
                className="sm:col-span-2 rounded-lg border px-3 py-2 text-sm"
              />
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
          <ul className="max-h-52 space-y-1 overflow-y-auto text-xs text-gray-600">
            {order.paymentRecords.slice().reverse().map((row, idx) => (
              <li key={row._id || idx} className="rounded border bg-gray-50 px-2 py-1.5 space-y-0.5">
                <p>
                  <strong className="capitalize">{row.kind}</strong> {formatPrice(row.amount)}
                  {' · '}{row.method || '—'}
                  {' · '}{row.verified ? 'verified' : 'unverified'}
                </p>
                <p className="text-[11px] text-gray-500">
                  Paid: {row.paidAt ? formatIstDateTime(row.paidAt) : '— (no historical date)'}
                  {row.verifiedAt ? ` · Verified: ${formatIstDateTime(row.verifiedAt)}` : ''}
                  {row.recordedByName ? ` · By ${row.recordedByName}` : ''}
                  {row.reference ? ` · Ref ${row.reference}` : ''}
                  {row.notes ? ` · ${row.notes}` : ''}
                  {(row.screenshotUrl || row.screenshotPath) ? (
                    <>
                      {' · '}
                      <a
                        href={row.screenshotUrl || row.screenshotPath}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-primary-700 underline"
                      >
                        Proof
                      </a>
                    </>
                  ) : null}
                </p>
                {!row.verified && writable && row._id ? (
                  <button
                    type="button"
                    className="text-[11px] font-semibold text-primary-700 underline"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        const res = await fetch(`/api/admin/orders/${order._id}/payments`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ paymentId: row._id, verified: true }),
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error || 'Verify failed');
                        toast.success('Payment verified (original paid date kept)');
                        await refresh();
                      } catch (err) {
                        toast.error(err.message || 'Verify failed');
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Verify without changing paid date
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        </>
        )}
        {Array.isArray(order.parcelRefs) && order.parcelRefs.length > 0 ? (
          <div className="border-t pt-2 space-y-1">
            <p className="text-xs font-bold text-gray-800">Parcel dispatch history</p>
            <ul className="max-h-36 space-y-1 overflow-y-auto text-xs text-gray-600">
              {order.parcelRefs.map((p, idx) => (
                <li key={String(p.parcelId || idx)} className="rounded border bg-gray-50 px-2 py-1">
                  {p.parcelCode || 'Parcel'} · {p.trackingNumber || 'no tracking'} · {p.courierCompany || '—'}
                  <br />
                  Dispatched: {p.dispatchedAt ? formatIstDateTime(p.dispatchedAt) : '—'}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border bg-white p-3 space-y-2">
        <h3 className="font-semibold text-gray-900">Revisions</h3>
        <p className="text-xs text-gray-600">
          Policy: one free revision per order. Free used: <strong>{freeRevisionUsed ? 'Yes' : 'No'}</strong> · Requests: <strong>{revisionCount}</strong>
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
              Record & verify charge
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

      {/* Production videos are shared via the Production WhatsApp Group — no order-level upload needed.
          Historical videos (if any) remain viewable below for backward compatibility. */}
      {Array.isArray(order.productionVideos) && order.productionVideos.length > 0 ? (
        <div className="rounded-xl border bg-white p-3 space-y-2">
          <h3 className="font-semibold text-gray-900">Historical production videos</h3>
          <p className="text-[11px] text-gray-500">
            New videos are shared in the Production WhatsApp Group. Existing uploads are kept for history.
          </p>
          {(order.productionVideos || []).map((vid, idx) => (
            <div key={vid._id || idx} className="flex flex-wrap items-center gap-2 text-xs">
              <a href={vid.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary-700 underline">
                Video {idx + 1}{vid.uploadedAt ? ` · ${new Date(vid.uploadedAt).toLocaleString('en-IN')}` : ''}
              </a>
            </div>
          ))}
        </div>
      ) : null}

      <div className="rounded-xl border bg-white p-3 space-y-2">
        <h3 className="font-semibold text-gray-900">Customer photos by product / size</h3>
        <p className="text-[11px] text-gray-500">
          {printingLocked
            ? 'Printing has started — photo changes are blocked.'
            : 'Add or replace photos per line item before printing starts. Originals are kept in history.'}
        </p>
        {items.map((item, idx) => {
          const photos = assetListFromItem(item);
          return (
            <div key={idx} className="rounded-lg border bg-gray-50 p-2 text-xs">
              <p className="font-semibold text-gray-900">
                Item {idx + 1}: {[item.title, item.variant].filter(Boolean).join(' · ') || 'Product'}
              </p>
              {photos.length ? (
                <ul className="mt-1 space-y-1">
                  {photos.map((photo) => (
                    <li key={photo.fieldPath} className="flex flex-wrap items-center gap-2">
                      <a href={photo.url} target="_blank" rel="noopener noreferrer" className="text-primary-700 underline">{photo.label}</a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-gray-500">No customer photos yet.</p>
              )}
            </div>
          );
        })}
        {writable && !printingLocked ? (
          <div className="space-y-2 border-t pt-2">
            <label className="block text-xs font-semibold">
              Product / size
              <select
                value={photoItemIndex}
                onChange={(e) => {
                  setPhotoItemIndex(Number(e.target.value) || 0);
                  setPhotoSlot('');
                }}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              >
                {items.map((item, idx) => (
                  <option key={idx} value={idx}>
                    Item {idx + 1}: {[item.title, item.variant].filter(Boolean).join(' · ') || 'Product'}
                  </option>
                ))}
              </select>
            </label>
            {selectedItemPhotos.length ? (
              <label className="block text-xs font-semibold">
                Replace existing slot (optional)
                <select
                  value={photoSlot}
                  onChange={(e) => setPhotoSlot(e.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                >
                  <option value="">Add new photo</option>
                  {selectedItemPhotos.map((photo) => (
                    <option key={photo.fieldPath} value={photo.fieldPath}>{photo.label}</option>
                  ))}
                </select>
              </label>
            ) : null}
            <input
              type="file"
              accept="image/*"
              disabled={busy}
              className="block w-full text-xs"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                const reason = window.prompt('Reason / note') || '';
                setBusy(true);
                try {
                  const body = new FormData();
                  body.append('file', file);
                  body.append('itemIndex', String(photoItemIndex));
                  body.append('reason', reason);
                  if (photoSlot) {
                    body.append('mode', 'replace');
                    body.append('fieldPath', photoSlot);
                    body.append('slotKey', photoSlot);
                  } else {
                    body.append('mode', 'append');
                    body.append('slotLabel', 'Customer Photos');
                    body.append('slotKey', `item-${photoItemIndex}`);
                  }
                  const res = await fetch(`/api/admin/orders/${order._id}/photos`, { method: 'POST', body });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || 'Photo update failed');
                  toast.success(data.mode === 'append' ? 'Photo added' : 'Photo replaced');
                  await refresh();
                } catch (err) {
                  toast.error(err.message || 'Photo update failed');
                } finally {
                  setBusy(false);
                }
              }}
            />
          </div>
        ) : null}
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
