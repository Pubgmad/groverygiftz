'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { applyMetaAdvancedMatching, canTrackMetaIdentity, clearMetaAdvancedMatching, configureMetaPixel, flushMetaPurchases, isMetaAdminPath, META_READY_EVENT, trackMetaEvent } from '@/lib/metaPixel';
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
    script.onload = () => {
      flushMetaPurchases();
      window.dispatchEvent(new Event(META_READY_EVENT));
    };
    document.head.appendChild(script);
  }

  if (window.__groveryGiftzMetaPixelId !== pixelId) {
    // Manual events supply verified order values; inferred events cannot do that.
    window.fbq('set', 'autoConfig', false, pixelId);
    window.fbq('optOut', pixelId, 'AutomaticMatching');
    window.fbq('init', pixelId);
    window.__groveryGiftzMetaPixelId = pixelId;
  }
}

export default function MetaPixelClient({ enabled, pixelId, testEventCode, trackingEnabled = enabled }) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const customerId = status === 'authenticated' && session?.user?.type === 'customer' ? String(session.user.id || '') : '';
  const identity = useRef(null);
  identity.current = status === 'loading' ? null : customerId;
  const lastPageView = useRef('');
  const landingUrl = useRef('');
  const [consent, setConsent] = useState(null);
  const cleanPixelId = String(pixelId || '').trim();
  const blocked = isMetaAdminPath(pathname);

  useEffect(() => {
    const guard = () => identity.current !== null && (!window.__groveryGiftzMetaMatchedCustomer || identity.current === window.__groveryGiftzMetaMatchedCustomer);
    window.__groveryGiftzMetaIdentityGuard = guard;
    return () => {
      if (window.__groveryGiftzMetaIdentityGuard === guard) {
        window.__groveryGiftzMetaIdentityGuard = () => false;
        clearMetaAdvancedMatching();
      }
    };
  }, []);

  useEffect(() => {
    const sync = () => {
      const choice = getMarketingConsent();
      setConsent(choice);
      if (!isMetaTrackingAllowed()) {
        if (choice === 'denied') clearMetaIdentifiers();
        lastPageView.current = '';
        clearMetaAdvancedMatching();
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
    const previous = window.__groveryGiftzMetaMatchedCustomer;
    if (previous && ((!allowed || blocked || !enabled) || (status !== 'loading' && previous !== customerId))) clearMetaAdvancedMatching();
    const ready = status !== 'loading' && session?.user?.type !== 'admin' && canTrackMetaIdentity();
    configureMetaPixel({ enabled: enabled && allowed && ready, pixelId: cleanPixelId, testEventCode, blocked });
    if (trackingEnabled && !blocked && allowed) captureMetaLandingAttribution(landingUrl.current);
    if (!enabled || !cleanPixelId || blocked || !allowed || !ready) return;

    installMetaPixel(cleanPixelId);
    window.fbq('consent', 'grant');
    flushMetaPurchases();
    window.dispatchEvent(new Event(META_READY_EVENT));

    if (lastPageView.current !== pathname) {
      lastPageView.current = pathname;
      trackMetaEvent('PageView', { page_path: pathname });
    }
  }, [blocked, cleanPixelId, consent, customerId, enabled, pathname, session?.user?.type, status, testEventCode, trackingEnabled]);

  useEffect(() => {
    if (!enabled || !cleanPixelId || blocked || !customerId || !isMetaTrackingAllowed() || !canTrackMetaIdentity()) return;
    let active = true;
    let controller;
    let requestId = 0;
    const refresh = async () => {
      if (!active || identity.current !== customerId || !isMetaTrackingAllowed() || !canTrackMetaIdentity()) return;
      const currentRequest = ++requestId;
      controller?.abort();
      const requestController = new AbortController();
      controller = requestController;
      const timeout = window.setTimeout(() => requestController.abort(), 5000);
      try {
        const response = await fetch('/api/meta/matching', { credentials: 'same-origin', cache: 'no-store', signal: requestController.signal });
        if (!active || currentRequest !== requestId || identity.current !== customerId) return;
        if (!response.ok) {
          if (response.status === 401 || response.status === 404) clearMetaAdvancedMatching();
          return;
        }
        const result = await response.json();
        if (!active || currentRequest !== requestId || identity.current !== customerId) return;
        if (result.customerId !== customerId) { clearMetaAdvancedMatching(); return; }
        applyMetaAdvancedMatching(customerId, result.userData);
      } catch {
        // Matching is optional: unavailable data must never interrupt shopping.
      } finally {
        window.clearTimeout(timeout);
      }
    };
    refresh();
    window.addEventListener('focus', refresh);
    return () => {
      active = false;
      controller?.abort();
      window.removeEventListener('focus', refresh);
    };
  }, [blocked, cleanPixelId, consent, customerId, enabled]);

  return null;
}
