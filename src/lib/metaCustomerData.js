import crypto from 'node:crypto';
import { isIP } from 'node:net';
import { validateMetaIdentifier } from './metaAttribution';

const lower = (value) => String(value || '').trim().toLowerCase();
const namePart = (value) => lower(value).normalize('NFKC').replace(/[^\p{L}]/gu, '');
const location = (value) => lower(value).normalize('NFKC').replace(/[\p{N}\p{P}\p{Z}\p{S}\s]/gu, '');
const email = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lower(value)) ? lower(value) : '';

export function normalizeMetaPhone(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (/^[6-9]\d{9}$/.test(digits)) return `91${digits}`;
  return /^[1-9]\d{7,14}$/.test(digits) && digits.length !== 10 ? digits : '';
}

export function hashMetaField(value, normalize = lower) {
  const original = lower(value);
  if (/^[a-f0-9]{64}$/.test(original)) return original;
  const normalized = normalize(value);
  return normalized ? crypto.createHash('sha256').update(normalized, 'utf8').digest('hex') : undefined;
}

export function buildMetaCustomerData(order) {
  const address = order.shippingAddress || {};
  const parts = String(address.fullName || '').trim().split(/\s+/).filter(Boolean);
  const customerId = order.customer?._id || order.customer;
  const fields = {
    em: hashMetaField(address.email || order.guestEmail, email),
    ph: hashMetaField(address.whatsappNumber || address.phone, normalizeMetaPhone),
    fn: hashMetaField(parts[0], namePart),
    ln: parts.length > 1 ? hashMetaField(parts[parts.length - 1], namePart) : undefined,
    ct: hashMetaField(address.city, location),
    st: hashMetaField(address.state, location),
    zp: hashMetaField(address.pincode, (value) => {
      const normalized = String(value || '').replace(/[\s-]/g, '');
      return /^\d{6}$/.test(normalized) ? normalized : '';
    }),
    country: hashMetaField('in'),
    external_id: hashMetaField(String(customerId || email(address.email || order.guestEmail) || '')),
  };
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
}

export function buildMetaBrowserData(metadata, now = Date.now()) {
  const expiresAt = metadata?.expiresAt ? new Date(metadata.expiresAt).getTime() : NaN;
  if (metadata?.allowed !== true || !Number.isFinite(expiresAt) || expiresAt <= now) return null;
  const agent = metadata.clientUserAgent;
  if (typeof agent !== 'string' || !agent.trim() || agent.length > 2048 || /[\r\n\x00]/.test(agent)) return null;
  const data = { client_user_agent: agent };
  const fbc = validateMetaIdentifier(metadata.fbc, 'fbc', now);
  const fbp = validateMetaIdentifier(metadata.fbp, 'fbp', now);
  if (fbc) data.fbc = fbc;
  if (fbp) data.fbp = fbp;
  if (typeof metadata.clientIpAddress === 'string' && isIP(metadata.clientIpAddress)) data.client_ip_address = metadata.clientIpAddress;
  return data;
}
