'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { FiDownload, FiExternalLink, FiPrinter, FiX } from 'react-icons/fi';
import AdminSelect from '@/components/admin/AdminSelect';
import { SHIPPING_LABEL_LAYOUTS, pageCountForLabels } from '@/lib/shippingLabelLayout';

const LAYOUT_OPTIONS = [
  { value: 'four', label: SHIPPING_LABEL_LAYOUTS.four.label },
  { value: 'two', label: SHIPPING_LABEL_LAYOUTS.two.label },
  { value: 'single', label: SHIPPING_LABEL_LAYOUTS.single.label },
];

async function postLabels({ orderIds, layout, generatePdf, confirmPartial }) {
  const res = await fetch('/api/admin/orders/shipping-labels', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({ orderIds, layout, generatePdf, confirmPartial }),
  });
  const type = res.headers.get('content-type') || '';
  if (type.includes('application/pdf')) {
    const blob = await res.blob();
    return {
      ok: res.ok,
      status: res.status,
      blob,
      filename: (res.headers.get('content-disposition') || '').match(/filename="([^"]+)"/i)?.[1]
        || `GroveryGiftz-Shipping-Labels.pdf`,
      pageCount: Number(res.headers.get('x-label-page-count') || 0),
      validCount: Number(res.headers.get('x-label-valid-count') || 0),
      invalidCount: Number(res.headers.get('x-label-invalid-count') || 0),
    };
  }
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

export default function ShippingLabelModal({
  open,
  orderIds = [],
  onClose,
  onOpenOrder,
}) {
  const [layout, setLayout] = useState('four');
  const [checking, setChecking] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [validation, setValidation] = useState(null);
  const [pdfUrl, setPdfUrl] = useState('');
  const [pdfName, setPdfName] = useState('GroveryGiftz-Shipping-Labels.pdf');
  const [pageCount, setPageCount] = useState(0);
  const iframeRef = useRef(null);
  const busy = checking || generating;

  const layoutMeta = SHIPPING_LABEL_LAYOUTS[layout] || SHIPPING_LABEL_LAYOUTS.four;

  const revokePdf = useCallback(() => {
    setPdfUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return '';
    });
  }, []);

  useEffect(() => {
    if (!open) {
      setLayout('four');
      setValidation(null);
      setChecking(false);
      setGenerating(false);
      revokePdf();
      setPageCount(0);
    }
  }, [open, revokePdf]);

  useEffect(() => () => revokePdf(), [revokePdf]);

  const orderIdsKey = useMemo(
    () => (Array.isArray(orderIds) ? orderIds.map(String).join('|') : ''),
    [orderIds],
  );

  const runValidation = useCallback(async () => {
    if (!orderIds.length) return;
    setChecking(true);
    setValidation(null);
    revokePdf();
    try {
      const result = await postLabels({ orderIds, layout, generatePdf: false });
      if (!result.ok) {
        toast.error(result.json?.error || 'Unable to validate orders');
        return;
      }
      setValidation(result.json);
      setPageCount(Number(result.json.pageCount || 0));
    } catch {
      toast.error('Unable to validate orders');
    } finally {
      setChecking(false);
    }
  }, [orderIds, orderIdsKey, layout, revokePdf]);

  useEffect(() => {
    if (open && orderIdsKey) runValidation();
  }, [open, orderIdsKey, layout, runValidation]);

  const generate = async ({ confirmPartial = false } = {}) => {
    if (busy || !orderIds.length) return;
    setGenerating(true);
    try {
      const result = await postLabels({
        orderIds,
        layout,
        generatePdf: true,
        confirmPartial,
      });

      if (result.status === 409 && result.json?.requiresConfirmation) {
        setValidation(result.json);
        const proceed = window.confirm(
          `${result.json.invalidCount} order(s) have incomplete shipping details.\n\nGenerate labels for the ${result.json.validCount} valid order(s) only?`,
        );
        if (proceed && result.json.validCount > 0) {
          setGenerating(false);
          await generate({ confirmPartial: true });
          return;
        }
        toast.error('Fix incomplete addresses or confirm generating valid orders only.');
        return;
      }

      if (!result.ok || !result.blob) {
        if (result.json?.invalid) setValidation(result.json);
        toast.error(result.json?.error || 'Unable to generate PDF');
        return;
      }

      revokePdf();
      const url = URL.createObjectURL(result.blob);
      setPdfUrl(url);
      setPdfName(result.filename);
      setPageCount(result.pageCount || pageCountForLabels(result.validCount || orderIds.length, layoutMeta));
      toast.success(`Generated ${result.validCount || ''} label(s)`);
    } catch {
      toast.error('Unable to generate PDF');
    } finally {
      setGenerating(false);
    }
  };

  const downloadPdf = () => {
    if (!pdfUrl) return;
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = pdfName;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const openPdfTab = () => {
    if (!pdfUrl) return;
    window.open(pdfUrl, '_blank', 'noopener,noreferrer');
  };

  const printPdf = () => {
    if (!pdfUrl) return;
    const frame = iframeRef.current;
    if (frame?.contentWindow) {
      try {
        frame.contentWindow.focus();
        frame.contentWindow.print();
        return;
      } catch {
        /* fall through */
      }
    }
    const win = window.open(pdfUrl, '_blank', 'noopener,noreferrer');
    if (win) {
      const timer = setInterval(() => {
        try {
          win.focus();
          win.print();
          clearInterval(timer);
        } catch {
          /* wait for PDF viewer */
        }
      }, 600);
      setTimeout(() => clearInterval(timer), 10000);
    } else {
      toast.error('Allow pop-ups to print, or download the PDF and print it.');
    }
  };

  const estimatedPages = useMemo(() => {
    const count = validation?.validCount ?? orderIds.length;
    return pageCountForLabels(count, layoutMeta);
  }, [validation, orderIds.length, layoutMeta]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[100dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:max-h-[92vh] sm:rounded-2xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900">Shipping labels</h2>
            <p className="text-xs leading-5 text-gray-500">
              {orderIds.length} selected · {layoutMeta.label} · {pageCount || estimatedPages} A4 page(s).
              Preview is the same PDF you download. Print at A4, 100% / Actual size. No prices or weights.
            </p>
          </div>
          <button type="button" onClick={onClose} className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border" aria-label="Close">
            <FiX />
          </button>
        </div>

        <div className="shrink-0 border-b px-4 py-3 sm:px-5">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <label className="block min-w-0 text-sm font-medium">
              Label layout
              <AdminSelect className="mt-1" value={layout} onChange={setLayout} options={LAYOUT_OPTIONS} />
            </label>
            <button
              type="button"
              disabled={busy || !orderIds.length}
              onClick={() => generate({ confirmPartial: false })}
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto"
            >
              {generating ? 'Generating PDF…' : checking ? 'Checking orders…' : 'Generate PDF'}
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          {validation?.invalid?.length ? (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-semibold">
                {validation.invalidCount} invalid · {validation.validCount} valid
              </p>
              <ul className="mt-2 space-y-2">
                {validation.invalid.map((row) => (
                  <li key={row.id} className="rounded-lg border border-amber-200 bg-white p-2">
                    <p className="font-semibold break-words">{row.orderNumber || row.id}</p>
                    <p className="text-xs break-words">{row.reason}</p>
                    {onOpenOrder ? (
                      <button
                        type="button"
                        className="mt-1 min-h-[36px] text-xs font-semibold text-primary-700 underline"
                        onClick={() => onOpenOrder(row.id)}
                      >
                        Open order
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {pdfUrl ? (
            <div className="overflow-hidden rounded-xl border bg-gray-100">
              <iframe
                ref={iframeRef}
                title="Shipping labels preview"
                src={pdfUrl}
                className="h-[min(62vh,560px)] w-full bg-white sm:h-[min(68vh,720px)]"
              />
              <p className="border-t bg-white px-3 py-2 text-[11px] leading-4 text-gray-500 sm:hidden">
                On some phones the in-page preview is limited — use Open PDF or Download, then print from your PDF app.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed bg-gray-50 p-6 text-sm text-gray-600">
              {checking
                ? 'Validating selected orders against current shipping addresses…'
                : 'Choose a layout and generate the PDF. Each label shows logo, FROM + QR, SHIP TO, order info, product/qty table, and footer — never prices or payment details.'}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t bg-white px-4 py-3 sm:px-5">
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
            <button
              type="button"
              disabled={!pdfUrl || busy}
              onClick={openPdfTab}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold disabled:opacity-50"
            >
              <FiExternalLink /> Open PDF
            </button>
            <button
              type="button"
              disabled={!pdfUrl || busy}
              onClick={downloadPdf}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold disabled:opacity-50"
            >
              <FiDownload /> Download
            </button>
            <button
              type="button"
              disabled={!pdfUrl || busy}
              onClick={printPdf}
              className="col-span-2 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-primary-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-1"
            >
              <FiPrinter /> Print labels
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
