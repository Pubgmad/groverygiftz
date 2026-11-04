'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ST_COURIERS_TRACKING_URL } from '@/lib/courierTracking';

export default function LabelTrackPage() {
  const params = useParams();
  const token = typeof params?.token === 'string' ? params.token : Array.isArray(params?.token) ? params.token[0] : '';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!token) {
      setError('Invalid tracking link.');
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/orders/label-track?token=${encodeURIComponent(token)}`, { cache: 'no-store' });
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setError(json.error || 'Unable to load tracking information.');
          setData(null);
        } else {
          setData(json);
          setError('');
        }
      } catch {
        if (!cancelled) setError('Unable to load tracking information.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  return (
    <main className="mx-auto min-h-[70vh] max-w-lg px-4 py-10">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary-700">Order tracking</p>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">{data?.brand || 'GroveryGiftz'}</h1>
        <p className="mt-1 text-sm text-gray-500">Secure status lookup from your shipping label QR code. No prices or personal address details are shown here.</p>

        {loading ? <p className="mt-6 text-sm text-gray-600">Loading…</p> : null}
        {error ? <p className="mt-6 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

        {data ? (
          <div className="mt-6 space-y-3 text-sm">
            <div className="rounded-xl border bg-gray-50 p-4">
              <p className="text-xs font-semibold text-gray-500">Order ID</p>
              <p className="text-lg font-bold text-primary-800">{data.orderNumber}</p>
            </div>
            <div className="rounded-xl border bg-gray-50 p-4">
              <p className="text-xs font-semibold text-gray-500">Status</p>
              <p className="font-semibold text-gray-900">{data.statusLabel || data.status}</p>
            </div>
            {data.deliveryEstimate ? (
              <div className="rounded-xl border bg-gray-50 p-4">
                <p className="text-xs font-semibold text-gray-500">Estimated delivery</p>
                <p className="font-semibold text-gray-900">{data.deliveryEstimate}</p>
              </div>
            ) : null}
            {data.trackingNumber ? (
              <div className="rounded-xl border bg-gray-50 p-4 space-y-2">
                <p className="text-xs font-semibold text-gray-500">Courier tracking ID</p>
                <p className="font-mono font-semibold text-gray-900 break-all">{data.trackingNumber}</p>
                <a
                  href={ST_COURIERS_TRACKING_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  Open ST Couriers tracking
                </a>
              </div>
            ) : (
              <p className="text-sm text-gray-600">Courier tracking ID will appear here once the parcel is booked.</p>
            )}
          </div>
        ) : null}

        <div className="mt-8 flex flex-col gap-2 sm:flex-row">
          <Link href="/" className="inline-flex min-h-[44px] items-center justify-center rounded-xl border px-4 py-2 text-sm font-semibold">
            Home
          </Link>
          <Link href="/track-order" className="inline-flex min-h-[44px] items-center justify-center rounded-xl border px-4 py-2 text-sm font-semibold">
            Track order help
          </Link>
        </div>
      </div>
    </main>
  );
}
