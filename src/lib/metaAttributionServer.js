import { isIP } from 'node:net';
import Order from '@/models/Order';
import dbConnect from '@/lib/db';
import { META_CONSENT_COOKIE, META_ATTRIBUTION_LIFETIME, readMetaCookies, validateMetaIdentifier } from './metaAttribution';

export function trustedMetaClientIp(req, env = process.env) {
  // Only configure this after the hosting proxy is verified to overwrite the header.
  const header = String(env.META_TRUSTED_CLIENT_IP_HEADER || '').toLowerCase();
  if (!['x-real-ip', 'cf-connecting-ip', 'x-forwarded-for'].includes(header)) return '';
  const values = String(req.headers.get(header) || '').split(',').map((value) => value.trim());
  let candidate;
  if (header === 'x-forwarded-for') {
    const hops = Number(env.META_TRUSTED_PROXY_HOPS);
    if (!Number.isInteger(hops) || hops < 1 || hops > 10 || values.length < hops) return '';
    candidate = values[values.length - hops];
  } else {
    if (values.length !== 1) return '';
    candidate = values[0];
  }
  return candidate && isIP(candidate) ? candidate : '';
}

export function captureMetaOrderAttribution(req, now = new Date()) {
  const cookies = readMetaCookies(req.headers.get('cookie') || '');
  const allowed = cookies[META_CONSENT_COOKIE] === 'granted' && req.headers.get('sec-gpc') !== '1' && req.headers.get('dnt') !== '1';
  const metadata = { allowed, capturedAt: now, expiresAt: new Date(now.getTime() + META_ATTRIBUTION_LIFETIME) };
  if (!allowed) return metadata;
  const agent = String(req.headers.get('user-agent') || '').trim();
  if (agent && agent.length <= 2048 && !/[\r\n\x00]/.test(agent)) metadata.clientUserAgent = agent;
  const fbc = validateMetaIdentifier(cookies._fbc, 'fbc', now.getTime());
  const fbp = validateMetaIdentifier(cookies._fbp, 'fbp', now.getTime());
  if (fbc) metadata.fbc = fbc;
  if (fbp) metadata.fbp = fbp;
  const ip = trustedMetaClientIp(req);
  if (ip) metadata.clientIpAddress = ip;
  return metadata;
}

export async function refreshMetaVerificationAttribution(req, cashfreeOrderId, customerId) {
  if (!cashfreeOrderId || !customerId) return;
  await dbConnect();
  const filter = { cashfreeOrderId, customer: customerId, metaConversionPurchaseSentAt: null };
  const order = await Order.findOne(filter).select('+metaAttribution').lean();
  if (!order) return;
  const current = captureMetaOrderAttribution(req);
  const cookies = readMetaCookies(req.headers.get('cookie') || '');
  const explicitlyDenied = cookies[META_CONSENT_COOKIE] === 'denied' || req.headers.get('sec-gpc') === '1' || req.headers.get('dnt') === '1';
  if (explicitlyDenied) {
    await Order.updateOne(filter, { $set: { metaAttribution: current } });
  } else if (current.allowed && !order.metaAttribution?.clientUserAgent) {
    // Recover a legacy pending order only from its authenticated customer's browser.
    await Order.updateOne(filter, { $set: { metaAttribution: current } });
  }
}

export async function cleanupExpiredMetaAttribution() {
  const now = Date.now();
  if (global.__groveryMetaAttributionSweepAt > now - 86400000) return;
  global.__groveryMetaAttributionSweepAt = now;
  try {
    await Order.updateMany({ 'metaAttribution.expiresAt': { $lte: new Date(now) } }, { $unset: { metaAttribution: '' } });
  } catch {
    global.__groveryMetaAttributionSweepAt = 0;
    console.error('Meta attribution expiry cleanup failed');
  }
}
