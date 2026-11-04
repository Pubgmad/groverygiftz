'use client';

import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  DESIGN_APPROVAL_LABELS,
  getLatestDesignVersionsBySheet,
} from '@/lib/opsConstants';

export default function OrderDesignSheetsPanel({ order, writable, onUpdated }) {
  const [busy, setBusy] = useState(false);
  const [sheetNumber, setSheetNumber] = useState('1');
  const [sheetLabel, setSheetLabel] = useState('');
  const [linkedItems, setLinkedItems] = useState([]);

  const sheets = useMemo(() => getLatestDesignVersionsBySheet(order || {}), [order]);
  const items = Array.isArray(order?.items) ? order.items : [];
  const approvals = Array.isArray(order?.designSheetApprovals) ? order.designSheetApprovals : [];

  const toggleLinked = (idx) => {
    setLinkedItems((prev) => (prev.includes(idx) ? prev.filter((n) => n !== idx) : [...prev, idx]));
  };

  const uploadSheet = async (file) => {
    if (!file || !order?._id) return;
    setBusy(true);
    try {
      const body = new FormData();
      body.append('file', file);
      body.append('sheetNumber', String(Math.max(1, Number(sheetNumber) || 1)));
      if (sheetLabel.trim()) body.append('sheetLabel', sheetLabel.trim());
      if (linkedItems.length) body.append('linkedItemIndexes', JSON.stringify(linkedItems));
      const res = await fetch(`/api/admin/orders/${order._id}/design`, { method: 'POST', body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      toast.success(`Uploaded ${data.sheetLabel || `Sheet ${data.sheetNumber}`} · v${data.version}`);
      setSheetLabel('');
      setLinkedItems([]);
      await onUpdated?.();
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const sharePreview = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/orders/${order._id}/design/share`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Share failed');
      if (data.whatsappShareUrl) window.open(data.whatsappShareUrl, '_blank', 'noopener,noreferrer');
      toast.success('WhatsApp opened with preview link (send manually)');
      await onUpdated?.();
    } catch (err) {
      toast.error(err.message || 'Share failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-w-0 rounded-lg border border-primary-100 bg-primary-50/40 p-3 space-y-3">
      <div>
        <h3 className="font-semibold text-primary-900">Printing sheets & design preview</h3>
        <p className="text-xs text-gray-600">
          Preview required: {order?.previewRequired === false ? 'No' : 'Yes'} ·{' '}
          {DESIGN_APPROVAL_LABELS[order?.designApprovalStatus] || 'Not Uploaded'}
          {order?.currentDesignVersion ? ` · latest v${order.currentDesignVersion}` : ''}
        </p>
        <p className="text-[11px] text-gray-500 mt-1">
          Upload one or more 12×18 sheets (or other layouts) separately. Replacing a sheet invalidates that sheet’s approval only.
        </p>
      </div>

      {order?.designChangeRequest ? (
        <p className="text-xs text-amber-800 whitespace-pre-wrap rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5">
          Customer feedback: {order.designChangeRequest}
        </p>
      ) : null}

      {sheets.length ? (
        <ul className="space-y-2">
          {sheets.map((sheet) => {
            const appr = approvals.find((row) => Number(row?.sheetNumber) === Number(sheet.sheetNumber));
            return (
              <li key={sheet.sheetNumber} className="rounded-xl border bg-white p-2 text-xs">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {sheet.sheetLabel || `Sheet ${sheet.sheetNumber}`} · v{sheet.versionNumber}
                    </p>
                    <p className="text-gray-500">
                      Approval: {appr?.status || order?.designApprovalStatus || '—'}
                      {sheet.linkedLabels?.length ? ` · ${sheet.linkedLabels.join(', ')}` : ''}
                    </p>
                  </div>
                  {sheet.url ? (
                    <a href={sheet.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary-700 underline">
                      Preview / download
                    </a>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-xs text-gray-500">No printing sheets uploaded yet.</p>
      )}

      {writable ? (
        <div className="space-y-2 rounded-xl border bg-white p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs font-semibold text-gray-700">
              Sheet number
              <input
                type="number"
                min="1"
                value={sheetNumber}
                onChange={(e) => setSheetNumber(e.target.value)}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs font-semibold text-gray-700">
              Sheet label
              <input
                value={sheetLabel}
                onChange={(e) => setSheetLabel(e.target.value)}
                placeholder={`Sheet ${sheetNumber || 1} · e.g. Combo sheet A`}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </label>
          </div>
          {items.length ? (
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-1">Link to products / sizes</p>
              <div className="flex flex-wrap gap-2">
                {items.map((item, idx) => {
                  const label = [item.title, item.variant].filter(Boolean).join(' · ') || `Item ${idx + 1}`;
                  const active = linkedItems.includes(idx);
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => toggleLinked(idx)}
                      className={`rounded-lg border px-2 py-1 text-[11px] font-semibold ${active ? 'border-primary-300 bg-primary-50 text-primary-900' : 'bg-gray-50 text-gray-700'}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          <label className="block text-xs font-semibold text-gray-700">
            Upload sheet file
            <input
              type="file"
              accept="image/*,application/pdf"
              disabled={busy}
              className="mt-1 block w-full text-sm"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) await uploadSheet(file);
              }}
            />
          </label>
          <button
            type="button"
            disabled={busy || !order?.currentDesignVersion}
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-green-200 bg-green-50 px-4 py-2 text-sm font-semibold text-green-900 disabled:opacity-50"
            onClick={sharePreview}
          >
            Share Preview on WhatsApp
          </button>
          <p className="text-[11px] text-gray-500">Opening WhatsApp does not confirm the message was delivered.</p>
        </div>
      ) : null}
    </div>
  );
}
