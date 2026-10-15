export const META_CONSENT_COOKIE = 'gg_marketing_consent';
export const META_CONSENT_EVENT = 'groverygiftz:marketing-consent';
export const META_PREFERENCES_EVENT = 'groverygiftz:marketing-preferences';
export const META_ATTRIBUTION_LIFETIME = 7 * 24 * 60 * 60 * 1000;
export const META_REQUIRE_MARKETING_CONSENT = process.env.NEXT_PUBLIC_META_REQUIRE_CONSENT === 'true';

export function isMetaPermissionAllowed(choice) {
  if (choice === 'denied') return false;
  return !META_REQUIRE_MARKETING_CONSENT || choice === 'granted';
}

export function readMetaCookies(raw = '') {
  const cookies = {};
  for (const part of String(raw).split(';')) {
    const split = part.indexOf('=');
    if (split < 0) continue;
    const key = part.slice(0, split).trim();
    if (!['_fbc', '_fbp', META_CONSENT_COOKIE].includes(key)) continue;
    try { cookies[key] = decodeURIComponent(part.slice(split + 1).trim()); } catch {}
  }
  return cookies;
}

export function validMetaClickId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,1800}$/.test(value);
}

function validBuilderAppendix(value) {
  if (['AQ', 'Ag', 'Aw', 'BA', 'BQ', 'Bg'].includes(value)) return true;
  if (!/^[A-Za-z0-9_-]{8}$/.test(value)) return false;
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const first = (alphabet.indexOf(value[0]) << 2) | (alphabet.indexOf(value[1]) >> 4);
  const language = ((alphabet.indexOf(value[1]) & 15) << 4) | (alphabet.indexOf(value[2]) >> 2);
  return first === 1 && language >= 1 && language <= 6;
}

export function validateMetaIdentifier(value, kind, now = Date.now()) {
  if (typeof value !== 'string' || value.length > 2048 || !['fbc', 'fbp'].includes(kind)) return '';
  const parts = value.split('.');
  if (parts.length !== 4 && parts.length !== 5) return '';
  if (parts[0] !== 'fb' || !/^\d{1,2}$/.test(parts[1]) || !/^\d{13}$/.test(parts[2])) return '';
  const created = Number(parts[2]);
  if (created > now + 300000 || created < now - 90 * 86400000) return '';
  if (kind === 'fbc' ? !validMetaClickId(parts[3]) : !/^\d{1,30}$/.test(parts[3])) return '';
  if (parts.length === 5 && !validBuilderAppendix(parts[4])) return '';
  return value;
}

export function getMarketingConsent() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;
  if (window.navigator?.globalPrivacyControl === true || ['1', 'yes'].includes(window.navigator?.doNotTrack)) return 'denied';
  const consent = readMetaCookies(document.cookie)[META_CONSENT_COOKIE];
  return ['granted', 'denied'].includes(consent) ? consent : null;
}

export function isMetaTrackingAllowed() {
  return typeof window !== 'undefined' && typeof document !== 'undefined' && isMetaPermissionAllowed(getMarketingConsent());
}

function cookieDomain() {
  const host = window.location.hostname;
  return host === 'groverygiftz.in' || host.endsWith('.groverygiftz.in') ? 'groverygiftz.in' : '';
}

function writeMetaCookie(name, value, maxAge) {
  const domain = cookieDomain();
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${window.location.protocol === 'https:' ? '; Secure' : ''}${domain ? `; Domain=${domain}` : ''}`;
}

export function clearMetaIdentifiers() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const domains = new Set(['', cookieDomain(), window.location.hostname]);
  for (const name of ['_fbc', '_fbp']) {
    for (const domain of domains) document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax${domain ? `; Domain=${domain}` : ''}`;
  }
  window.__groveryGiftzMetaPurchasesPending?.clear();
}

export function setMarketingConsent(choice) {
  if (typeof window === 'undefined' || !['granted', 'denied'].includes(choice)) return 'denied';
  const privacySignal = window.navigator?.globalPrivacyControl === true || ['1', 'yes'].includes(window.navigator?.doNotTrack);
  const next = privacySignal ? 'denied' : choice;
  writeMetaCookie(META_CONSENT_COOKIE, next, 180 * 86400);
  if (next === 'denied') {
    clearMetaIdentifiers();
    if (typeof window.fbq === 'function') window.fbq('consent', 'revoke');
    // An authenticated customer's unsent orders must also honor withdrawal.
    window.fetch?.('/api/meta/consent', { method: 'POST', credentials: 'same-origin', keepalive: true }).catch(() => {});
  } else if (typeof window.fbq === 'function') window.fbq('consent', 'grant');
  window.dispatchEvent(new Event(META_CONSENT_EVENT));
  return getMarketingConsent() || 'denied';
}

export function captureMetaLandingAttribution(landingUrl) {
  if (!isMetaTrackingAllowed()) return;
  const cookies = readMetaCookies(document.cookie);
  const existing = validateMetaIdentifier(cookies._fbc, 'fbc');
  let clickId = '';
  try {
    const url = new URL(landingUrl || window.location.href);
    if (url.origin !== window.location.origin) return;
    clickId = url.searchParams.get('fbclid') || '';
  } catch { return; }
  if (!validMetaClickId(clickId)) return;
  if (existing && existing.split('.')[3] === clickId) return;
  const domain = cookieDomain() || window.location.hostname;
  const index = Math.max(0, domain.split('.').length - 1);
  writeMetaCookie('_fbc', `fb.${index}.${Date.now()}.${clickId}`, 90 * 86400);
  // _fbp is owned by the existing Pixel SDK; do not create a second identifier.
}
