'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { FiDownload } from 'react-icons/fi';

function filenameFromDisposition(header, fallback) {
  const match = String(header || '').match(/filename="([^"]+)"/i);
  return match?.[1] || fallback;
}

export default function DownloadCsvButton({
  href,
  fallbackName = 'export.csv',
  disabled = false,
  children = 'Download CSV',
}) {
  const [busy, setBusy] = useState(false);

  const download = async () => {
    if (busy || disabled) return;
    setBusy(true);
    try {
      const res = await fetch(href, { cache: 'no-store' });
      const type = res.headers.get('content-type') || '';
      if (!res.ok || !type.includes('text/csv')) {
        const data = type.includes('application/json') ? await res.json().catch(() => ({})) : {};
        toast.error(data.error || 'Could not download CSV. Please try again.');
        return;
      }
      const blob = await res.blob();
      const name = filenameFromDisposition(res.headers.get('content-disposition'), fallbackName);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Could not download CSV. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={download}
      disabled={busy || disabled}
      className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
    >
      <FiDownload className="shrink-0" />
      {busy ? 'Preparing CSV...' : children}
    </button>
  );
}
