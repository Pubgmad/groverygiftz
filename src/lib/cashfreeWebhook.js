import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifyCashfreeWebhook(rawBody, headers, secret) {
  const signature = headers.get('x-webhook-signature') || '';
  const timestamp = headers.get('x-webhook-timestamp') || '';
  if (!secret || !/^\d{1,20}$/.test(timestamp) || !/^[A-Za-z0-9+/]{43}=$/.test(signature)) return false;
  const expected = createHmac('sha256', secret).update(timestamp + rawBody).digest();
  const received = Buffer.from(signature, 'base64');
  return received.length === expected.length && timingSafeEqual(received, expected);
}
