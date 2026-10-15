'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { configureMetaPixel, flushMetaPurchases, isMetaAdminPath, trackMetaEvent } from '@/lib/metaPixel';
import { captureMetaLandingAttribution, clearMetaIdentifiers, getMarketingConsent, META_CONSENT_EVENT, META_PREFERENCES_EVENT, setMarketingConsent } from '@/lib/metaAttribution';

function installMetaPixel(pixelId) {
  if (typeof window === 'undefined' || !pixelId) return;

  if (!window.fbq) {
    window.fbq = function fbq() {
      window.fbq.callMethod ? window.fbq.callMethod.apply(window.fbq, arguments) : window.fbq.queue.push(arguments);
    };
    if (!window._fbq) window._fbq = window.fbq;
    window.fbq.push = window.fbq;
    window.fbq.loaded = true;
    window.fbq.version = '2.0';
    window.fbq.queue = [];
  }

  if (!document.getElementById('meta-pixel-sdk')) {
    const script = document.createElement('script');
    script.id = 'meta-pixel-sdk';
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(script);
  }

  if (window.__groveryGiftzMetaPixelId !== pixelId) {
    // Manual events supply verified order values; inferred events cannot do that.
    window.fbq('set', 'autoConfig', false, pixelId);
    window.fbq('init', pixelId);
    window.__groveryGiftzMetaPixelId = pixelId;
  }
}

export default function MetaPixelClient({ enabled, pixelId, testEventCode, trackingEnabled = enabled }) {
  const pathname = usePathname();
  const lastPageView = useRef('');
  const landingUrl = useRef('');
  const [consent, setConsent] = useState(null);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const cleanPixelId = String(pixelId || '').trim();
  const blocked = isMetaAdminPath(pathname);

  useEffect(() => {
    const sync = () => {
      const choice = getMarketingConsent();
      setConsent(choice);
      if (choice !== 'granted') {
        if (choice === 'denied') clearMetaIdentifiers();
        lastPageView.current = '';
        if (typeof window.fbq === 'function') window.fbq('consent', 'revoke');
      }
    };
    const open = () => setPreferencesOpen(true);
    sync();
    window.addEventListener(META_CONSENT_EVENT, sync);
    window.addEventListener(META_PREFERENCES_EVENT, open);
    window.addEventListener('focus', sync);
    return () => {
      window.removeEventListener(META_CONSENT_EVENT, sync);
      window.removeEventListener(META_PREFERENCES_EVENT, open);
      window.removeEventListener('focus', sync);
    };
  }, []);

  useEffect(() => {
    if (!landingUrl.current || new URL(window.location.href).searchParams.has('fbclid')) landingUrl.current = window.location.href;
    const allowed = consent === 'granted';
    configureMetaPixel({ enabled: enabled && allowed, pixelId: cleanPixelId, testEventCode, blocked });
    if (trackingEnabled && !blocked && allowed) captureMetaLandingAttribution(landingUrl.current);
    if (!enabled || !cleanPixelId || blocked || !allowed) return;

    installMetaPixel(cleanPixelId);
    window.fbq('consent', 'grant');
    flushMetaPurchases();

    if (lastPageView.current !== pathname) {
      lastPageView.current = pathname;
      trackMetaEvent('PageView', { page_path: pathname });
    }
  }, [blocked, cleanPixelId, consent, enabled, pathname, testEventCode, trackingEnabled]);

  if (blocked || !trackingEnabled && !preferencesOpen || consent !== null && !preferencesOpen) return null;
  const choose = (choice) => { setConsent(setMarketingConsent(choice)); setPreferencesOpen(false); };
  const privacyBlocked = consent === 'denied' && typeof window !== 'undefined' && (window.navigator?.globalPrivacyControl === true || ['1', 'yes'].includes(window.navigator?.doNotTrack));
  return (
    <section aria-label="Marketing cookie preferences" className="fixed bottom-24 left-4 right-4 z-40 max-h-[calc(100dvh-7rem)] max-w-sm overflow-y-auto rounded-lg border border-gray-200 bg-white p-4 text-gray-800 shadow-lg sm:bottom-6 sm:right-auto sm:max-h-[calc(100dvh-3rem)] sm:w-96">
      <h2 className="text-base font-semibold">Marketing cookies</h2>
      <p className="mt-2 text-sm leading-relaxed">Allow cookies that help us measure ads and purchases? Shopping and checkout work without them.</p>
      {privacyBlocked && <p className="mt-2 text-sm">Your browser privacy preference disables marketing tracking.</p>}
      <Link href="/policies/privacy-policy" className="mt-2 inline-block text-sm text-primary-600 underline">Privacy policy</Link>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <button type="button" onClick={() => choose('denied')} className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold">Reject</button>
        <button type="button" disabled={privacyBlocked} onClick={() => choose('granted')} className="min-h-11 rounded-md border border-primary-600 px-3 py-2 text-sm font-semibold text-primary-700 disabled:opacity-50">Accept</button>
      </div>
    </section>
  );
}
