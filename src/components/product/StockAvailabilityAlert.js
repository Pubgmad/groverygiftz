'use client';

import { FiAlertCircle, FiCheckCircle, FiPackage } from 'react-icons/fi';
import { resolveStockAlertState } from '@/lib/stockAlert';

export default function StockAvailabilityAlert({ product, selectedOptions = [] }) {
  const state = resolveStockAlertState(product, selectedOptions);
  if (!state) return null;

  const toneClass = {
    out: 'border-red-200 bg-red-50 text-red-800',
    low: 'border-amber-200 bg-amber-50 text-amber-900',
    ok: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  }[state.tone];

  const Icon = state.tone === 'out' ? FiAlertCircle : state.tone === 'low' ? FiPackage : FiCheckCircle;

  return (
    <div
      className={`mb-5 flex items-center gap-3 rounded-2xl border px-4 py-3 ${toneClass}`}
      role="status"
      aria-live="polite"
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/80 shadow-sm ${
          state.tone === 'low' ? 'motion-safe:animate-[pulse_2.4s_ease-in-out_infinite]' : ''
        }`}
      >
        <Icon size={18} aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-bold leading-snug">{state.label}</p>
        {state.tone === 'ok' && state.variantManaged ? (
          <p className="mt-0.5 text-xs opacity-80">Availability varies by selected option</p>
        ) : null}
      </div>
    </div>
  );
}
