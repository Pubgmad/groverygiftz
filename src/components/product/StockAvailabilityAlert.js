'use client';

import { resolveLowStockAlert } from '@/lib/stockAlert';

/** Compact animated low-stock urgency chip — does not replace the original stock display. */
export default function StockAvailabilityAlert({ product, selectedOptions = [] }) {
  const alert = resolveLowStockAlert(product, selectedOptions);
  if (!alert) return null;

  return (
    <div
      className="stock-urgency-alert mb-4 inline-flex max-w-full items-center gap-2.5 rounded-full border border-amber-300/80 bg-gradient-to-r from-amber-50 via-orange-50 to-accent-50 px-3.5 py-2 text-sm font-bold text-amber-950"
      role="status"
      aria-live="polite"
    >
      <span className="stock-urgency-alert__icon text-base leading-none" aria-hidden>🔥</span>
      <span className="min-w-0 leading-snug">{alert.label}</span>
    </div>
  );
}
