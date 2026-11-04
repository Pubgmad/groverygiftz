export const SHIPPING_LABEL_LAYOUTS = {
  four: { id: 'four', label: 'A4 — 4 Labels', perPage: 4, cols: 2, rows: 2 },
  two: { id: 'two', label: 'A4 — 2 Labels', perPage: 2, cols: 1, rows: 2 },
  single: { id: 'single', label: 'Single Label — 1 per A4', perPage: 1, cols: 1, rows: 1 },
};

export const MAX_SHIPPING_LABEL_ORDERS = 100;

export function normalizeShippingLabelLayout(value) {
  const key = String(value || 'four').toLowerCase();
  if (key === '2' || key === 'two') return SHIPPING_LABEL_LAYOUTS.two;
  if (key === '1' || key === 'single' || key === 'one') return SHIPPING_LABEL_LAYOUTS.single;
  return SHIPPING_LABEL_LAYOUTS.four;
}

export function pageCountForLabels(orderCount, layout) {
  const perPage = Math.max(1, Number(layout?.perPage || 4));
  const count = Math.max(0, Number(orderCount || 0));
  return count === 0 ? 0 : Math.ceil(count / perPage);
}
