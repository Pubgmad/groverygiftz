'use client';

import { resolveLowStockAlert } from '@/lib/stockAlert';

/** Compact animated low-stock urgency chip — does not replace the original stock display. */
export default function StockAvailabilityAlert({ product, selectedOptions = [] }) {
  const alert = resolveLowStockAlert(product, selectedOptions);
  if (!alert) return null;

  return (
    <div
      className="mb-4 inline-flex max-w-full items-center gap-2 rounded-full border border-amber-300/80 bg-gradient-to-r from-amber-50 to-orange-50 px-3.5 py-2 text-sm font-bold text-amber-950 shadow-sm motion-safe:animate-[pulse_2.8s_ease-in-out_infinite]"
      role="status"
      aria-live="polite"
    >
      <span className="text-base leading-none" aria-hidden>🔥</span>
      <span className="min-w-0 leading-snug">{alert.label}</span>
    </div>
  );
}
