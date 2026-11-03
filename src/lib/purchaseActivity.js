import Order from '@/models/Order';

const CANCELLED = new Set(['cancelled']);

/**
 * Count customers who purchased a product in the given window from paid, non-cancelled orders.
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

export function formatPurchaseActivityMessage(template, count, periodDays) {
  const safeCount = Math.max(0, Number(count) || 0);
  const days = Math.max(1, Number(periodDays) || 30);
  const fallback = '{count} customers purchased this in the last {days} days';
  const source = String(template || '').trim() || fallback;
  if (safeCount <= 0) return '';
  return source
    .replace(/\{count\}/gi, String(safeCount))
    .replace(/\{days\}/gi, String(days));
}
