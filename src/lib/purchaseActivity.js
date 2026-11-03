import Order from '@/models/Order';
import { formatPurchaseActivityMessage } from '@/lib/purchaseActivityMessage';

const CANCELLED = new Set(['cancelled']);

/**
 * Count customers who purchased a product in the given window from paid, non-cancelled orders.
 * Server-only — do not import this module from client components.
 */
export async function countProductPurchases(productId, periodDays = 30) {
  const days = Math.max(1, Math.min(365, Number(periodDays) || 30));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const id = productId;

  const rows = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: since },
        status: { $nin: [...CANCELLED] },
        paymentStatus: 'paid',
        'items.product': id,
      },
    },
    { $unwind: '$items' },
    { $match: { 'items.product': id } },
    {
      $group: {
        _id: {
          customer: { $ifNull: ['$customer', '$guestEmail'] },
        },
      },
    },
    { $count: 'customers' },
  ]);

  return {
    count: Number(rows[0]?.customers || 0),
    periodDays: days,
  };
}

export { formatPurchaseActivityMessage };
