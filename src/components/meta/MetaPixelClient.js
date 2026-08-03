'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { configureMetaPixel, isMetaAdminPath, trackMetaEvent } from '@/lib/metaPixel';

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
    window.fbq('init', pixelId);
    window.__groveryGiftzMetaPixelId = pixelId;
  }
}

export default function MetaPixelClient({ enabled, pixelId, testEventCode }) {
  const pathname = usePathname();
  const lastPageView = useRef('');
  const cleanPixelId = String(pixelId || '').trim();
  const blocked = isMetaAdminPath(pathname);

  useEffect(() => {
    configureMetaPixel({ enabled, pixelId: cleanPixelId, testEventCode, blocked });
    if (!enabled || !cleanPixelId || blocked) return;

    installMetaPixel(cleanPixelId);

    if (lastPageView.current !== pathname) {
      lastPageView.current = pathname;
      trackMetaEvent('PageView', { page_path: pathname });
    }
  }, [blocked, cleanPixelId, enabled, pathname, testEventCode]);

  return null;
}