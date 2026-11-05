'use client';

import { FiShoppingBag } from 'react-icons/fi';
import { formatPurchaseActivityMessage } from '@/lib/purchaseActivityMessage';

/**
 * Admin-configured sales milestone — promotional / manually maintained figures,
 * not auto-verified order analytics.
 */
export default function PurchaseActivityBadge({ product }) {
  const message = formatPurchaseActivityMessage(product?.purchaseActivity || {});
  if (!message) return null;

  return (
    <div
      className="product-sales-milestone w-full min-w-0 sm:w-auto"
      role="status"
    >
      <span className="product-sales-milestone__icon" aria-hidden>
        <FiShoppingBag size={14} />
      </span>
      <span className="product-sales-milestone__text min-w-0 leading-snug">{message}</span>
    </div>
  );
}
