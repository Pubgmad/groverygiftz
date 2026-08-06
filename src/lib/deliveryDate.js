export function addDaysSkippingSundays(startDate, days) {
  const totalDays = Math.max(0, Number(days || 0));
  const date = new Date(startDate || Date.now());
  let added = 0;
  while (added < totalDays) {
    date.setDate(date.getDate() + 1);
    if (date.getDay() !== 0) added += 1;
  }
  return date;
}

export function extractMaxDays(text, fallbackDays = 8) {
  const matches = String(text || '').match(/\d+/g);
  if (!matches?.length) return fallbackDays;
  return Math.max(...matches.map(Number));
}

export function formatDeliveryDate(date) {
  return new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

export function buildDeliveryEstimateText(baseEstimate, options = {}) {
  const fallbackDays = Number(options.fallbackDays || 8);
  const days = extractMaxDays(baseEstimate, fallbackDays);
  const date = addDaysSkippingSundays(options.startDate || Date.now(), days);
  const label = String(baseEstimate || '').trim() || (days + ' days');
  return label + ' - expected by ' + formatDeliveryDate(date) + ' (Sundays skipped)';
}
