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
