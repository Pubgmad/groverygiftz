'use client';

import { resolveStockAvailabilityIndicator } from '@/lib/stockAlert';

const LEVEL_UI = {
  high: {
    className: 'stock-avail stock-avail--high',
    icon: '●',
    iconClass: 'stock-avail__dot',
  },
  medium: {
    className: 'stock-avail stock-avail--medium',
    icon: '!',
    iconClass: 'stock-avail__badge',
  },
  low: {
    className: 'stock-avail stock-avail--low',
    icon: '!',
    iconClass: 'stock-avail__badge',
  },
  sold_out: {
    className: 'stock-avail stock-avail--soldout',
    icon: '○',
    iconClass: 'stock-avail__dot',
  },
};

/**
 * Animated stock availability indicator — placed directly under product price.
 * Quantity and state come from Admin Panel inventory (selected variant when chosen).
 */
export default function StockAvailabilityAlert({ product, selectedOptions = [] }) {
  const alert = resolveStockAvailabilityIndicator(product, selectedOptions);
  if (!alert) return null;

  const ui = LEVEL_UI[alert.level] || LEVEL_UI.high;

  return (
    <div
      className={`${ui.className} mb-4 w-full max-w-xl`}
      role="status"
      aria-live="polite"
      data-stock-level={alert.level}
      data-stock-qty={alert.quantity}
    >
      <span className={`stock-avail__icon ${ui.iconClass}`} aria-hidden>
        {ui.icon}
      </span>
      <span className="stock-avail__text min-w-0 leading-snug">{alert.label}</span>
      {alert.level !== 'sold_out' && Number.isFinite(alert.quantity) ? (
        <span className="stock-avail__qty tabular-nums">{alert.quantity}</span>
      ) : null}
    </div>
  );
}
