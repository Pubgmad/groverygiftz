'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { configureMetaPixel, flushMetaPurchases, isMetaAdminPath, trackMetaEvent } from '@/lib/metaPixel';
import { captureMetaLandingAttribution, clearMetaIdentifiers, getMarketingConsent, isMetaTrackingAllowed, META_CONSENT_EVENT } from '@/lib/metaAttribution';

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
  const cleanPixelId = String(pixelId || '').trim();
  const blocked = isMetaAdminPath(pathname);

  useEffect(() => {
    const sync = () => {
      const choice = getMarketingConsent();
      setConsent(choice);
      if (!isMetaTrackingAllowed()) {
        if (choice === 'denied') clearMetaIdentifiers();
        lastPageView.current = '';
        if (typeof window.fbq === 'function') window.fbq('consent', 'revoke');
      }
    };
    sync();
    window.addEventListener(META_CONSENT_EVENT, sync);
    window.addEventListener('focus', sync);
    return () => {
      window.removeEventListener(META_CONSENT_EVENT, sync);
      window.removeEventListener('focus', sync);
    };
  }, []);

  useEffect(() => {
    if (!landingUrl.current || new URL(window.location.href).searchParams.has('fbclid')) landingUrl.current = window.location.href;
    const allowed = isMetaTrackingAllowed();
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

  return null;
}
