export const GOOGLE_CONSENT_COOKIE = 'gg_google_consent';
export const GOOGLE_CONSENT_EVENT = 'groverygiftz:google-consent';
export const GOOGLE_CONSENT_SYNC_EVENT = 'groverygiftz:google-consent-synced';

export function hasGooglePrivacySignal() {
  return typeof window !== 'undefined' && (window.navigator?.globalPrivacyControl === true || ['1', 'yes'].includes(window.navigator?.doNotTrack));
}

export function getGoogleConsent() {
  if (hasGooglePrivacySignal()) return { analytics: 'denied', advertising: 'denied' };
  const unknown = { analytics: null, advertising: null };
  if (typeof document === 'undefined' || typeof window === 'undefined') return unknown;
  try {
    const entry = window.__groveryGoogleConsent ? null : document.cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${GOOGLE_CONSENT_COOKIE}=`));
    const saved = window.__groveryGoogleConsent || (entry ? JSON.parse(decodeURIComponent(entry.slice(GOOGLE_CONSENT_COOKIE.length + 1))) : null);
    if (saved?.version !== 1 || !['granted', 'denied'].includes(saved.analytics) || !['granted', 'denied'].includes(saved.advertising)) return unknown;
    return { analytics: saved.analytics, advertising: saved.advertising };
  } catch { return unknown; }
}

export function getGoogleConsentState() {
  const choice = getGoogleConsent();
  const ads = choice.advertising === 'granted' ? 'granted' : 'denied';
  return { analytics_storage: choice.analytics === 'granted' ? 'granted' : 'denied', ad_storage: ads, ad_user_data: ads, ad_personalization: ads };
}

export function saveGoogleConsent({ analytics, advertising }) {
  if (typeof window === 'undefined' || typeof document === 'undefined' || typeof analytics !== 'boolean' || typeof advertising !== 'boolean') return false;
  const blocked = hasGooglePrivacySignal();
  const saved = { version: 1, analytics: analytics && !blocked ? 'granted' : 'denied', advertising: advertising && !blocked ? 'granted' : 'denied' };
  const host = window.location.hostname;
  const domain = host === 'groverygiftz.in' || host.endsWith('.groverygiftz.in') ? '; Domain=groverygiftz.in' : '';
  // Consent choices are necessary preferences, not an analytics identifier.
  window.__groveryGoogleConsent = saved;
  try {
    document.cookie = `${GOOGLE_CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(saved))}; Path=/; Max-Age=${180 * 86400}; SameSite=Lax${window.location.protocol === 'https:' ? '; Secure' : ''}${domain}`;
    if (document.cookie.split(';').some((part) => part.trim() === `${GOOGLE_CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(saved))}`)) delete window.__groveryGoogleConsent;
  } catch {}
  window.dispatchEvent(new Event(GOOGLE_CONSENT_EVENT));
  return true;
}
