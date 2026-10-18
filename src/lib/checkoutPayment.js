const returnKey = (customerId) => `gg-checkout-return:${customerId}`;
const validOrderId = (value) => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,200}$/.test(value);
export const PAYMENT_RETURN_PATH = '/checkout/return';
export const ORDER_CONFIRMATION_PATH = '/checkout/success';

export function checkoutOutcomeUrl(mode, orderId) {
  const path = mode === 'confirmation' ? ORDER_CONFIRMATION_PATH : PAYMENT_RETURN_PATH;
  return validOrderId(orderId) ? `${path}?cashfree_order_id=${encodeURIComponent(orderId)}` : path;
}

export function isCheckoutReturnCompleted(customerId, orderId) {
  if (readCheckoutReturn(customerId, true) !== orderId) return false;
  try { return JSON.parse(window.sessionStorage.getItem(returnKey(customerId)))?.completed === true; } catch { return false; }
}

export function rememberCheckoutReturn(customerId, orderId, completed = false) {
  if (!customerId || !validOrderId(orderId)) return;
  try { window.sessionStorage.setItem(returnKey(customerId), JSON.stringify({ orderId, completed, createdAt: Date.now() })); } catch {}
}

export function readCheckoutReturn(customerId, includeCompleted = false) {
  if (!customerId) return '';
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(returnKey(customerId)) || 'null');
    const age = Date.now() - saved?.createdAt;
    return validOrderId(saved?.orderId) && (includeCompleted || !saved.completed) && age >= 0 && age < 72 * 3600000 ? saved.orderId : '';
  } catch { return ''; }
}

export function forgetCheckoutReturn(customerId) {
  if (!customerId) return;
  try { window.sessionStorage.removeItem(returnKey(customerId)); } catch {}
}

export async function verifyCheckoutPayment(orderId, { signal, request = fetch, wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) } = {}) {
  let lastError;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (signal?.aborted) throw new DOMException('Verification cancelled', 'AbortError');
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    const timeout = setTimeout(abort, 30000);
    try {
      const response = await request('/api/orders/verify-cashfree-payment', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }), cache: 'no-store', signal: controller.signal,
      });
      const data = await response.json();
      if (response.ok && data.success === true && data.paymentStatus === 'paid') return data;
      if (!(data.retryable === true || response.status === 429 || response.status >= 500)) return data;
      lastError = new Error(data.error || 'Payment confirmation is still pending. Please check again.');
    } catch (error) {
      if (signal?.aborted) throw error;
      lastError = error;
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
    }
    if (attempt < 3) await wait((attempt + 1) * 1500);
  }
  return { success: false, retryable: true, error: lastError?.message || 'Unable to confirm payment yet. Please check again.' };
}
