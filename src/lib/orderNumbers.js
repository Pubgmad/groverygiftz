import Counter from '@/models/Counter';

export async function getNextPaidOrderNumber() {
  const counter = await Counter.findOneAndUpdate(
    { key: 'paidOrder' },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  return `GG${String(counter.seq).padStart(4, '0')}`;
}

export function isFinalOrderNumber(orderNumber) {
  return /^GG\d{4,}$/.test(String(orderNumber || ''));
}
