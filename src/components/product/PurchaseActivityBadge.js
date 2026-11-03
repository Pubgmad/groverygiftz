'use client';

import { FiShoppingBag } from 'react-icons/fi';
import { formatPurchaseActivityMessage } from '@/lib/purchaseActivityMessage';

export default function PurchaseActivityBadge({ product }) {
  const message = formatPurchaseActivityMessage(product?.purchaseActivity || {});
  if (!message) return null;

  return (
    <div className="mb-3 inline-flex max-w-full items-center gap-2 rounded-full border border-primary-100 bg-primary-50/80 px-3 py-1.5 text-xs font-semibold text-primary-800 sm:text-sm">
      <FiShoppingBag size={14} className="shrink-0 text-primary-600" aria-hidden />
      <span className="min-w-0 leading-snug">{message}</span>
    </div>
  );
}
