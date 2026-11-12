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
import { withAdminThumbUrl } from '@/lib/adminImageThumb';

function customerFileFromOriginal(url = '') {
  const raw = String(url || '');
  const marker = '/api/customization-upload/original-file/';
  const index = raw.indexOf(marker);
  if (index === -1) return '';
  const encodedPath = raw.slice(index + marker.length).split('?')[0];
  return encodedPath ? `/api/customization-upload/customer-file/${encodedPath}` : '';
}

function pickDisplayUrl(asset) {
  if (!asset) return '';
  if (typeof asset === 'string') {
    return customerFileFromOriginal(asset) || asset.trim();
  }
  // Admin session can load customer-file without a guest signature. Prefer that over
  // possibly-expired signed displayUrl values stored on the order.
  return customerFileFromOriginal(asset.url)
    || customerFileFromOriginal(asset.originalUrl)
    || customerFileFromOriginal(asset.displayUrl)
    || String(asset.displayUrl || asset.previewUrl || asset.url || asset.originalUrl || '').trim();
}

function pickDownloadUrl(asset) {
  if (!asset) return '';
  if (typeof asset === 'string') return asset.trim();
  return String(asset.originalUrl || asset.url || asset.displayUrl || '').trim();
}

function assetListFromItem(item) {
  const out = [];
  const fields = item?.customFields;
  if (fields && typeof fields === 'object') {
    Object.entries(fields).forEach(([label, value]) => {
      if (label === 'Variant Label Uploads' && value && typeof value === 'object') {
        Object.entries(value).forEach(([vk, vv]) => {
          const displayUrl = pickDisplayUrl(vv);
          if (displayUrl) {
            out.push({
              label: `${label}: ${vk}`,
              url: displayUrl,
              downloadUrl: pickDownloadUrl(vv),
              fieldPath: `customFields.Variant Label Uploads.${vk}`,
            });
          }
        });
      } else if (Array.isArray(value)) {
        value.forEach((entry, idx) => {
          const displayUrl = pickDisplayUrl(entry);
          if (displayUrl) {
            out.push({
              label: `${label} #${idx + 1}`,
              url: displayUrl,
              downloadUrl: pickDownloadUrl(entry),
              fieldPath: `customFields.${label}.${idx}`,
            });
          }
        });
      } else {
        const displayUrl = pickDisplayUrl(value);
        if (displayUrl && (/\.(png|jpe?g|webp|gif|heic|heif)/i.test(displayUrl) || displayUrl.includes('/media/') || displayUrl.includes('/api/customization'))) {
          out.push({
            label,
            url: displayUrl,
            downloadUrl: pickDownloadUrl(value),
            fieldPath: `customFields.${label}`,
          });
        }
      }
    });
  }
  (item?.collageUploads || []).forEach((group, g) => {
    (group?.images || []).forEach((img, idx) => {
      const displayUrl = pickDisplayUrl(img);
      if (displayUrl) {
        out.push({
          label: `${group.label || `Collage ${g + 1}`} #${idx + 1}`,
          url: displayUrl,
          downloadUrl: pickDownloadUrl(img),
          fieldPath: `collageUploads.${g}.images.${idx}`,
        });
      }
    });
  });
  return out;
}

export default function OrderOpsPanel({ order, writable, onUpdated }) {
  const [opsStatus, setOpsStatus] = useState(order?.opsStatus || 'new_order');
  const [staff, setStaff] = useState([]);
  const [assignedTo, setAssignedTo] = useState(order?.assignedTo ? String(order.assignedTo) : '');
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
  const [showPayForm, setShowPayForm] = useState(false);
  const [courierCompany, setCourierCompany] = useState(order?.courierCompany || '');
  const [trackingUrl, setTrackingUrl] = useState(order?.trackingUrl || '');
  const [parcelForm, setParcelForm] = useState({
    courierCompany: order?.courierCompany || 'ST Couriers',
    trackingNumber: '',
    weightKg: '',
    destinationState: '',
    courierCharges: '',
    dispatchedAt: toDatetimeLocalIst(new Date()),
    notes: '',
  });
  const [photoItemIndex, setPhotoItemIndex] = useState(0);
  const [photoSlot, setPhotoSlot] = useState('');
  const [photoNewSize, setPhotoNewSize] = useState('');
  const [photoReason, setPhotoReason] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [replaceQueue, setReplaceQueue] = useState([]);
  const [comms, setComms] = useState(order?.salesCommsChecklist || {});
  const isWhatsAppLike = ['whatsapp', 'instagram'].includes(String(order?.orderSource || '').toLowerCase());

  const paymentSummary = useMemo(() => {
    const rows = Array.isArray(order?.paymentRecords) ? order.paymentRecords : [];
    let verifiedPaid = 0;
    let unverifiedPaid = 0;
    rows.forEach((row) => {
      if (row?.rejected) return;
      const amount = Number(row?.amount) || 0;
      if (row?.verified) verifiedPaid += amount;
      else unverifiedPaid += amount;
    });
    return {
      verifiedPaid: Math.round(verifiedPaid * 100) / 100,
      unverifiedPaid: Math.round(unverifiedPaid * 100) / 100,
      remaining: Math.max(0, Math.round(((Number(order?.total) || 0) - verifiedPaid) * 100) / 100),
    };
  }, [order?.paymentRecords, order?.total]);

  const totalCourierExpense = useMemo(() => (
    (Array.isArray(order?.parcelRefs) ? order.parcelRefs : []).reduce(
      (sum, p) => sum + (Number(p.courierCharges) || Number(p.calculatedCourierCost) || 0),
      0,
    )
  ), [order?.parcelRefs]);

  useEffect(() => {
    setOpsStatus(order?.opsStatus || 'new_order');
    setAssignedTo(order?.assignedTo ? String(order.assignedTo) : '');
    setExpectedDispatchDate(toYmdIst(order?.expectedDispatchDate));
    setCourierCompany(order?.courierCompany || '');
    setTrackingUrl(order?.trackingUrl || '');
    setComms(order?.salesCommsChecklist || {});
  }, [
    order?._id,
    order?.opsStatus,
    order?.assignedTo,
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
      setShowPayForm(false);
      await refresh();
    } catch (err) {
      toast.error(err.message || 'Payment failed');
    } finally {
      setBusy(false);
    }
  };

  const recordParcel = async () => {
    if (!writable) return;
    setBusy(true);
    try {
      const dispatchedAtDate = parcelForm.dispatchedAt
        ? fromDatetimeLocalIst(parcelForm.dispatchedAt)
        : null;
      if (!dispatchedAtDate) throw new Error('Actual dispatch / handover date-time is required');
      const res = await fetch(`/api/admin/orders/${order._id}/parcels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courierCompany: parcelForm.courierCompany,
          trackingNumber: parcelForm.trackingNumber,
          weightKg: parcelForm.weightKg !== '' ? Number(parcelForm.weightKg) : null,
          destinationState: parcelForm.destinationState,
          courierCharges: parcelForm.courierCharges !== '' ? Number(parcelForm.courierCharges) : null,
          dispatchedAt: dispatchedAtDate.toISOString(),
          notes: parcelForm.notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Parcel save failed');
      toast.success(`Parcel ${data.parcel?.parcelCode || ''} recorded`);
      setParcelForm((p) => ({
        ...p,
        trackingNumber: '',
        weightKg: '',
        courierCharges: '',
        notes: '',
        dispatchedAt: toDatetimeLocalIst(new Date()),
      }));
      await refresh();
    } catch (err) {
      toast.error(err.message || 'Parcel save failed');
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
          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => patchOps({ expectedDispatchDate: expectedDispatchDate || null })}
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              Save expected dispatch date
            </button>
            <p className="text-[11px] text-gray-500">
              Editor assignment and operation status run through the automatic workflow (and quick actions below). This button only saves Expected Dispatch Date.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => patchOps({ opsStatus })}
                className="inline-flex min-h-[40px] items-center justify-center rounded-xl border px-3 py-2 text-xs font-semibold disabled:opacity-60"
              >
                Save operation status
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => patchOps({ assignedTo: assignedTo || null })}
                className="inline-flex min-h-[40px] items-center justify-center rounded-xl border px-3 py-2 text-xs font-semibold disabled:opacity-60"
              >
                Update assigned editor
              </button>
            </div>
          </div>
        ) : null}
        {writable && quickActions.length ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {quickActions.map(([status, label]) => (
              <button
                key={status}
                type="button"
                disabled={busy}
                onClick={() => {
                  let notes = `Quick action: ${label}`;
                  if (status === 'on_hold') {
                    const reason = typeof window !== 'undefined'
                      ? window.prompt('On Hold reason (required for clarification / pause)')
                      : '';
                    if (reason == null) return;
                    const trimmed = String(reason).trim();
                    if (!trimmed) {
                      toast.error('Record an On Hold reason before pausing the order');
                      return;
                    }
                    notes = `On Hold: ${trimmed}`;
                  }
                  setOpsStatus(status);
                  patchOps({
                    opsStatus: status,
                    assignedTo: assignedTo || null,
                    expectedDispatchDate: expectedDispatchDate || null,
                    notes,
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

      {isWhatsAppLike ? (
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
      ) : null}

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
          <p>Total order amount: <strong>{formatPrice(order.total || 0)}</strong></p>
          <p>Verified paid: <strong>{formatPrice(paymentSummary.verifiedPaid)}</strong></p>
          <p>Unverified payments: <strong>{formatPrice(paymentSummary.unverifiedPaid)}</strong></p>
          <p>Remaining balance: <strong>{formatPrice(paymentSummary.remaining)}</strong></p>
          <p className="col-span-2">Payment status: <strong>{order.balanceStatus || order.paymentStatus || '—'}</strong></p>
          {Number(order.revisionCharges) > 0 ? (
            <p className="col-span-2">Revision charges: <strong>{formatPrice(order.revisionCharges)}</strong>
              {order.revisionPaymentVerified ? ' · verified' : ' · awaiting verification'}
            </p>
          ) : null}
        </div>
        {writable ? (
          <div className="space-y-2 border-t pt-2">
            <button
              type="button"
              onClick={() => setShowPayForm((v) => !v)}
              className="min-h-[44px] w-full rounded-xl bg-emerald-700 px-3 py-2 text-sm font-bold text-white"
            >
              {showPayForm ? 'Hide payment form' : '+ ADD PAYMENT'}
            </button>
            {showPayForm ? (
              <>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input type="number" min="0" step="0.01" placeholder="Amount received" value={pay.amount} onChange={(e) => setPay((p) => ({ ...p, amount: e.target.value }))} className="rounded-lg border px-3 py-2 text-sm" />
                  <select value={pay.kind} onChange={(e) => setPay((p) => ({ ...p, kind: e.target.value }))} className="rounded-lg border px-3 py-2 text-sm">
                    <option value="advance">Advance</option>
                    <option value="balance">Balance</option>
                    <option value="additional">Additional Payment</option>
                    <option value="revision">Revision Payment</option>
                    <option value="other">Other</option>
                  </select>
                  <input placeholder="Payment method" value={pay.method} onChange={(e) => setPay((p) => ({ ...p, method: e.target.value }))} className="rounded-lg border px-3 py-2 text-sm" />
                  <input placeholder="Transaction reference" value={pay.reference} onChange={(e) => setPay((p) => ({ ...p, reference: e.target.value }))} className="rounded-lg border px-3 py-2 text-sm" />
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
                    placeholder="Internal notes (optional)"
                    value={pay.notes}
                    onChange={(e) => setPay((p) => ({ ...p, notes: e.target.value }))}
                    className="sm:col-span-2 rounded-lg border px-3 py-2 text-sm"
                  />
                </div>
                <label className="flex items-center gap-2 text-xs font-semibold">
                  <input type="checkbox" checked={pay.verified} onChange={(e) => setPay((p) => ({ ...p, verified: e.target.checked }))} />
                  Mark verified (screenshot alone does not verify)
                </label>
                <label className="block text-xs font-semibold text-gray-700">
                  Upload payment screenshot
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="mt-1 block w-full text-xs font-normal"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (!file) return;
                      recordPayment({ file });
                    }}
                  />
                </label>
                <button type="button" disabled={busy} onClick={() => recordPayment()} className="min-h-[44px] w-full rounded-xl border px-3 py-2 text-sm font-semibold disabled:opacity-60">
                  Save payment
                </button>
              </>
            ) : null}
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
        <div className="border-t pt-2">
          <p className="mb-1 text-xs font-bold text-gray-800">Payment history</p>
          {Array.isArray(order.paymentRecords) && order.paymentRecords.length > 0 ? (
          <ul className="max-h-52 space-y-1 overflow-y-auto text-xs text-gray-600">
            {order.paymentRecords.slice().reverse().map((row, idx) => (
              <li key={row._id || idx} className="rounded border bg-gray-50 px-2 py-1.5 space-y-0.5">
                <p>
                  <strong className="capitalize">{row.kind}</strong> {formatPrice(row.amount)}
                  {' · '}{row.method || '—'}
                  {' · '}{row.rejected ? 'rejected' : row.verified ? 'verified' : 'unverified'}
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
                        Screenshot
                      </a>
                    </>
                  ) : null}
                </p>
                {!row.rejected && !row.verified && writable && row._id ? (
                  <div className="flex flex-wrap gap-2">
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
                      Verify
                    </button>
                    <button
                      type="button"
                      className="text-[11px] font-semibold text-red-700 underline"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          const res = await fetch(`/api/admin/orders/${order._id}/payments`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ paymentId: row._id, rejected: true }),
                          });
                          const data = await res.json();
                          if (!res.ok) throw new Error(data.error || 'Reject failed');
                          toast.success('Payment rejected');
                          await refresh();
                        } catch (err) {
                          toast.error(err.message || 'Reject failed');
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      Reject
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
          ) : (
            <p className="text-xs text-gray-500">No payment records yet.</p>
          )}
        </div>
        </>
        )}
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
        <h3 className="font-semibold text-gray-900">Courier &amp; Dispatch Details</h3>
        <p className="text-[11px] text-gray-500">
          Use ST Couriers for this workflow. Expected dispatch is set above; actual dispatch is recorded per parcel at handover.
          {order?.orderSource === 'website'
            ? ' Website customer tracking uses the ST Couriers Tracking ID field on the order.'
            : ' WhatsApp tracking is shared manually with the customer.'}
        </p>
        {(order?.courierCompany || order?.trackingUrl || order?.trackingNumber) ? (
          <div className="rounded-lg border bg-gray-50 px-2 py-1.5 text-[11px] text-gray-600">
            Historical order-level courier data preserved:
            {order.courierCompany ? ` ${order.courierCompany}` : ''}
            {order.trackingNumber ? ` · ${order.trackingNumber}` : ''}
            {order.trackingUrl ? (
              <>
                {' · '}
                <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer" className="text-primary-700 underline">Tracking URL</a>
              </>
            ) : null}
          </div>
        ) : null}
        {writable ? (
          <div className="space-y-2 rounded-lg border border-emerald-100 bg-emerald-50/40 p-2">
            <p className="text-xs font-bold text-gray-800">+ Add ST Couriers parcel under this Order ID</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-xs font-semibold text-gray-700">
                Courier company *
                <select
                  value={parcelForm.courierCompany || 'ST Couriers'}
                  onChange={(e) => setParcelForm((p) => ({ ...p, courierCompany: e.target.value }))}
                  className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm font-normal"
                >
                  <option value="ST Couriers">ST Couriers</option>
                </select>
              </label>
              <label className="text-xs font-semibold text-gray-700">
                Tracking ID
                <input
                  placeholder="ST Couriers tracking ID"
                  value={parcelForm.trackingNumber}
                  onChange={(e) => setParcelForm((p) => ({ ...p, trackingNumber: e.target.value }))}
                  className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm font-normal"
                />
              </label>
              <label className="text-xs font-semibold text-gray-700 sm:col-span-2">
                Tracking URL (ST Couriers)
                <input
                  readOnly
                  value="https://stcourier.com/track/shipment"
                  className="mt-1 w-full rounded-lg border bg-gray-50 px-3 py-2 text-sm font-normal text-gray-600"
                />
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Parcel weight (kg)"
                value={parcelForm.weightKg}
                onChange={(e) => setParcelForm((p) => ({ ...p, weightKg: e.target.value }))}
                className="rounded-lg border bg-white px-3 py-2 text-sm"
              />
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Courier charges ₹"
                value={parcelForm.courierCharges}
                onChange={(e) => setParcelForm((p) => ({ ...p, courierCharges: e.target.value }))}
                className="rounded-lg border bg-white px-3 py-2 text-sm"
              />
              <input
                placeholder="Destination"
                value={parcelForm.destinationState}
                onChange={(e) => setParcelForm((p) => ({ ...p, destinationState: e.target.value }))}
                className="rounded-lg border bg-white px-3 py-2 text-sm"
              />
              <label className="text-xs font-semibold text-gray-700">
                Actual dispatch date &amp; time (IST) *
                <input
                  type="datetime-local"
                  value={parcelForm.dispatchedAt}
                  onChange={(e) => setParcelForm((p) => ({ ...p, dispatchedAt: e.target.value }))}
                  className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm font-normal"
                />
              </label>
              <input
                placeholder="Internal notes"
                value={parcelForm.notes}
                onChange={(e) => setParcelForm((p) => ({ ...p, notes: e.target.value }))}
                className="sm:col-span-2 rounded-lg border bg-white px-3 py-2 text-sm"
              />
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={recordParcel}
              className="min-h-[40px] w-full rounded-xl bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
            >
              Save parcel dispatch
            </button>
          </div>
        ) : null}
        {Array.isArray(order.parcelRefs) && order.parcelRefs.length > 0 ? (
          <div className="space-y-1">
            <p className="text-xs font-bold text-gray-800">
              Parcel history · Total courier expense {formatPrice(totalCourierExpense)}
            </p>
            <ul className="max-h-44 space-y-1 overflow-y-auto text-xs text-gray-600">
              {order.parcelRefs.map((p, idx) => (
                <li key={String(p.parcelId || p.parcelCode || idx)} className="rounded border bg-gray-50 px-2 py-1.5">
                  <strong>{p.parcelCode || `Parcel ${idx + 1}`}</strong>
                  {' · '}{p.courierCompany || '—'}
                  {' · '}{p.trackingNumber || 'no tracking'}
                  {p.weightKg != null ? ` · ${p.weightKg} kg` : ''}
                  {p.courierCharges != null ? ` · ${formatPrice(p.courierCharges)}` : ''}
                  {p.destinationState ? ` · ${p.destinationState}` : ''}
                  <br />
                  Actual dispatch: {p.dispatchedAt ? formatIstDateTime(p.dispatchedAt) : '—'}
                  {p.dispatchedByName ? ` · By ${p.dispatchedByName}` : ''}
                  {p.notes ? ` · ${p.notes}` : ''}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-xs text-gray-500">No parcels recorded on this order yet.</p>
        )}
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
                <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {photos.map((photo) => (
                    <li key={photo.fieldPath} className="min-w-0 space-y-1">
                      <a
                        href={photo.downloadUrl || photo.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="relative block aspect-square overflow-hidden rounded-md border bg-white"
                        title={photo.label}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={withAdminThumbUrl(photo.url)} alt={photo.label} className="h-full w-full object-cover" loading="lazy" decoding="async" />
                      </a>
                      <p className="truncate text-[10px] font-semibold text-gray-700">{photo.label}</p>
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
            <p className="text-xs font-bold text-gray-800">Queue photo replacements (multiple allowed)</p>
            <label className="block text-xs font-semibold">
              Product / size line
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
                Existing photo to replace
                <select
                  value={photoSlot}
                  onChange={(e) => setPhotoSlot(e.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                >
                  <option value="">Add new photo (append)</option>
                  {selectedItemPhotos.map((photo) => (
                    <option key={photo.fieldPath} value={photo.fieldPath}>{photo.label}</option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="block text-xs font-semibold">
              New / target frame size (optional)
              <input
                value={photoNewSize}
                onChange={(e) => setPhotoNewSize(e.target.value)}
                placeholder="e.g. 12x10 — leave blank to keep current size"
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs font-semibold">
              Replacement reason
              <input
                value={photoReason}
                onChange={(e) => setPhotoReason(e.target.value)}
                placeholder="Customer request / damaged / wrong crop"
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </label>
            <input
              type="file"
              accept="image/*"
              disabled={busy}
              className="block w-full text-xs"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                e.target.value = '';
                setPhotoFile(file);
              }}
            />
            {photoFile ? <p className="text-[11px] text-gray-600">Selected: {photoFile.name}</p> : null}
            <button
              type="button"
              disabled={busy || !photoFile}
              onClick={() => {
                if (!photoFile) return;
                const item = items[photoItemIndex];
                const originalSize = String(item?.variant || '').replace(/^Size:\s*/i, '') || '';
                setReplaceQueue((prev) => [
                  ...prev,
                  {
                    id: `${Date.now()}-${prev.length}`,
                    itemIndex: photoItemIndex,
                    fieldPath: photoSlot || '',
                    file: photoFile,
                    reason: photoReason || '',
                    originalSize,
                    newSize: photoNewSize || originalSize,
                    label: photoSlot
                      ? (selectedItemPhotos.find((p) => p.fieldPath === photoSlot)?.label || photoSlot)
                      : 'New photo',
                  },
                ]);
                setPhotoFile(null);
                setPhotoReason('');
                setPhotoNewSize('');
                toast.success('Replacement added to queue');
              }}
              className="min-h-[40px] w-full rounded-xl border px-3 py-2 text-xs font-semibold disabled:opacity-50"
            >
              Add to replacement queue
            </button>
            {replaceQueue.length ? (
              <div className="space-y-2 rounded-lg border bg-white p-2">
                <ul className="max-h-36 space-y-1 overflow-y-auto text-[11px] text-gray-700">
                  {replaceQueue.map((row) => (
                    <li key={row.id} className="flex items-start justify-between gap-2 rounded border px-2 py-1">
                      <span>
                        Item {row.itemIndex + 1} · {row.label}
                        {row.newSize ? ` · size ${row.originalSize || '—'} → ${row.newSize}` : ''}
                        {row.reason ? ` · ${row.reason}` : ''}
                        {' · '}{row.file?.name}
                      </span>
                      <button
                        type="button"
                        className="shrink-0 font-semibold text-red-600"
                        onClick={() => setReplaceQueue((prev) => prev.filter((r) => r.id !== row.id))}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    if (!replaceQueue.length) return;
                    setBusy(true);
                    let ok = 0;
                    try {
                      for (const row of replaceQueue) {
                        const body = new FormData();
                        body.append('file', row.file);
                        body.append('itemIndex', String(row.itemIndex));
                        body.append('reason', row.reason || '');
                        body.append('originalSize', row.originalSize || '');
                        body.append('newSize', row.newSize || '');
                        if (row.fieldPath) {
                          body.append('mode', 'replace');
                          body.append('fieldPath', row.fieldPath);
                          body.append('slotKey', row.fieldPath);
                        } else {
                          body.append('mode', 'append');
                          body.append('slotLabel', 'Customer Photos');
                          body.append('slotKey', `item-${row.itemIndex}`);
                        }
                        const res = await fetch(`/api/admin/orders/${order._id}/photos`, { method: 'POST', body });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error || 'Photo update failed');
                        ok += 1;
                      }
                      toast.success(`${ok} photo update${ok === 1 ? '' : 's'} saved`);
                      setReplaceQueue([]);
                      await refresh();
                    } catch (err) {
                      toast.error(err.message || 'Photo update failed');
                      if (ok) await refresh();
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className="min-h-[40px] w-full rounded-xl bg-primary-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
                >
                  Save all replacements ({replaceQueue.length})
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {Array.isArray(order.photoHistory) && order.photoHistory.length > 0 ? (
        <div className="rounded-xl border bg-white p-3 space-y-2">
          <h3 className="font-semibold text-gray-900">Photo version history</h3>
          <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-gray-600">
            {order.photoHistory.slice().reverse().map((row, idx) => (
              <li key={row._id || idx} className="rounded border bg-gray-50 px-2 py-1">
                {row.slotKey || 'photo'}
                {row.itemIndex != null ? ` · item ${Number(row.itemIndex) + 1}` : ''}
                {row.originalSize || row.newSize
                  ? ` · size ${row.originalSize || '—'} → ${row.newSize || row.originalSize || '—'}`
                  : ''}
                {row.reason ? ` · ${row.reason}` : ''}
                {row.replacedByName ? ` · by ${row.replacedByName}` : ''}
                {' · '}
                {row.replacedAt ? new Date(row.replacedAt).toLocaleString('en-IN') : ''}
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
