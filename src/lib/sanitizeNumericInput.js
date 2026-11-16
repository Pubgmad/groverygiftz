/**
 * Strip accidental leading zeros from decimal price inputs while typing.
 * Keeps empty, "0", and intermediate decimals like "0." / "12." editable.
 */
export function sanitizeDecimalInput(raw) {
  let s = String(raw ?? '');
  if (s === '') return '';
  s = s.replace(/[^\d.]/g, '');
  const firstDot = s.indexOf('.');
  if (firstDot !== -1) {
    s = `${s.slice(0, firstDot + 1)}${s.slice(firstDot + 1).replace(/\./g, '')}`;
  }
  const [intPart = '', decPart] = s.split('.');
  let intClean = intPart.replace(/^0+(?=\d)/, '');
  if (intClean === '' && (intPart.length > 0 || decPart !== undefined)) intClean = '0';
  if (decPart !== undefined) return `${intClean}.${decPart}`;
  return intClean;
}

/** Integer quantity / count inputs — never leave values like "080". */
export function sanitizeIntegerInput(raw, { allowEmpty = true } = {}) {
  let s = String(raw ?? '').replace(/\D/g, '');
  if (s === '') return allowEmpty ? '' : '0';
  s = s.replace(/^0+(?=\d)/, '');
  return s === '' ? '0' : s;
}
