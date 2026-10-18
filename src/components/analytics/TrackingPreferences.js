'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FiX } from 'react-icons/fi';
import { META_PREFERENCES_EVENT, setMarketingConsent } from '@/lib/metaAttribution';
import { getGoogleConsent, GOOGLE_CONSENT_EVENT, hasGooglePrivacySignal, saveGoogleConsent } from '@/lib/googleConsent';
import { isGA4AdminPath } from '@/lib/ga4';

export default function TrackingPreferences() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [advertising, setAdvertising] = useState(false);
  const [privacyBlocked, setPrivacyBlocked] = useState(false);

  useEffect(() => {
    const sync = (open = false) => {
      const choice = getGoogleConsent();
      setAnalytics(choice.analytics === 'granted');
      setAdvertising(choice.advertising === 'granted');
      setPrivacyBlocked(hasGooglePrivacySignal());
      setVisible(open);
    };
    const refresh = () => sync();
    const open = () => sync(true);
    sync();
    window.addEventListener(META_PREFERENCES_EVENT, open);
    window.addEventListener(GOOGLE_CONSENT_EVENT, refresh);
    window.addEventListener('focus', refresh);
    return () => {
      window.removeEventListener(META_PREFERENCES_EVENT, open);
      window.removeEventListener(GOOGLE_CONSENT_EVENT, refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  if (!visible || isGA4AdminPath(pathname)) return null;
  const save = (allowAnalytics, allowAds) => {
    if (!saveGoogleConsent({ analytics: allowAnalytics, advertising: allowAds })) return;
    // Reuse the existing advertising preference path for Meta; no sender changes.
    try { setMarketingConsent(getGoogleConsent().advertising); } catch {}
    setVisible(false);
  };

  return (
    <section aria-labelledby="cookie-preferences-title" className="fixed bottom-24 left-3 right-3 z-40 max-h-[calc(100dvh-7rem)] overflow-y-auto rounded-lg border border-gray-200 bg-white p-4 text-gray-800 shadow-lg sm:bottom-6 sm:left-6 sm:right-auto sm:max-h-[calc(100dvh-3rem)] sm:w-[400px] sm:max-w-[calc(100vw-3rem)]">
      <div className="flex items-start justify-between gap-3">
        <h2 id="cookie-preferences-title" className="text-base font-semibold">Cookie preferences</h2>
        <button type="button" aria-label="Close cookie preferences" title="Close cookie preferences" onClick={() => setVisible(false)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100"><FiX size={20} /></button>
      </div>
      <p className="mt-2 text-sm leading-relaxed">Optional cookies are your choice. Shopping and checkout work without them.</p>
      <div className="mt-3 space-y-3 text-sm">
        <label className="flex items-start gap-3"><input type="checkbox" checked disabled className="mt-1 h-4 w-4 shrink-0" /><span><strong className="block">Necessary</strong><span className="text-gray-600">Sign-in, cart and checkout. Always active.</span></span></label>
        <label className="flex items-start gap-3"><input type="checkbox" checked={analytics} disabled={privacyBlocked} onChange={(event) => setAnalytics(event.target.checked)} className="mt-1 h-4 w-4 shrink-0" /><span><strong className="block">Analytics</strong><span className="text-gray-600">Google Analytics measures visits, shopping activity and purchases.</span></span></label>
        <label className="flex items-start gap-3"><input type="checkbox" checked={advertising} disabled={privacyBlocked} onChange={(event) => setAdvertising(event.target.checked)} className="mt-1 h-4 w-4 shrink-0" /><span><strong className="block">Advertising</strong><span className="text-gray-600">Google and Meta may use data for advertising measurement and personalized ads.</span></span></label>
      </div>
      {privacyBlocked && <p className="mt-3 text-sm text-gray-600">Your browser privacy preference disables optional tracking.</p>}
      <Link href="/policies/privacy-policy" className="mt-3 inline-block text-sm text-primary-600 underline">Privacy policy</Link>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => save(false, false)} className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold">Reject optional</button>
        <button type="button" onClick={() => save(analytics, advertising)} className="min-h-11 rounded-md border border-primary-600 px-3 py-2 text-sm font-semibold text-primary-700">Save choices</button>
        <button type="button" disabled={privacyBlocked} onClick={() => save(true, true)} className="col-span-2 min-h-11 rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Accept all optional</button>
      </div>
    </section>
  );
}
