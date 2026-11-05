const UNIT_LABEL = {
  hours: { one: 'hour', many: 'hours' },
  days: { one: 'day', many: 'days' },
};

export function formatPurchaseActivityMessage({
  enabled,
  purchaseCount,
  timeQuantity,
  timeUnit = 'hours',
  labelTemplate = '',
} = {}) {
  if (!enabled) return '';
  const count = Math.max(0, Number(purchaseCount) || 0);
  const amount = Math.max(1, Number(timeQuantity) || 1);
  if (count <= 0) return '';

  const unitKey = String(timeUnit || 'hours').toLowerCase() === 'days' ? 'days' : 'hours';
  const unit = UNIT_LABEL[unitKey];
  const unitText = amount === 1 ? unit.one : unit.many;
  const template = String(labelTemplate || '').trim()
    || '{count} orders placed in the last {time} {unit}';

  return template
    .replace(/\{count\}/gi, String(count))
    .replace(/\{time\}/gi, String(amount))
    .replace(/\{days\}/gi, String(amount))
    .replace(/\{unit\}/gi, unitText);
}
