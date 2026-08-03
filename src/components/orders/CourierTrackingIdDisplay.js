'use client';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { FiCopy, FiCheck, FiExternalLink } from 'react-icons/fi';

const ST_COURIERS_TRACKING_URL = 'https://stcourier.com/track/shipment';

export default function CourierTrackingIdDisplay({ trackingNumber }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(trackingNumber);
      setCopied(true);
      toast.success('Tracking ID copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy. Select and copy manually.');
    }
  };

  return (
    <div className="rounded-xl border border-primary-100 bg-primary-50/50 px-4 py-4 space-y-3">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">ST Couriers tracking ID</p>
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-mono font-bold text-gray-900 text-lg tracking-tight break-all">{trackingNumber}</p>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-primary-200 bg-white text-primary-700 hover:bg-primary-50 font-medium shrink-0"
        >
          {copied ? <FiCheck size={16} className="text-green-600" /> : <FiCopy size={16} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <a
          href={ST_COURIERS_TRACKING_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
        >
          Track on ST Couriers <FiExternalLink size={15} />
        </a>
        <p className="text-sm text-gray-600 leading-relaxed">Open ST Couriers and paste this tracking ID to see shipment updates.</p>
      </div>
    </div>
  );
}
