'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { GOOGLE_CONSENT_EVENT, GOOGLE_CONSENT_SYNC_EVENT } from '@/lib/googleConsent';
import { GA4_MEASUREMENT_ID } from '@/lib/ga4Data';
import { completeGA4GoogleLogin, initializeGA4, isGA4AdminPath, setGA4Ready, syncGA4Privacy, trackGA4PageView } from '@/lib/ga4';

export default function GoogleAnalytics() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [allowed, setAllowed] = useState(false);
  const { data: session, status } = useSession();

  useEffect(() => {
    const sync = () => {
      const enabled = syncGA4Privacy();
      setAllowed(enabled);
      if (enabled) {
        initializeGA4();
        trackGA4PageView();
      }
      window.dispatchEvent(new Event(GOOGLE_CONSENT_SYNC_EVENT));
    };
    sync();
    window.addEventListener(GOOGLE_CONSENT_EVENT, sync);
    window.addEventListener('focus', sync);
    return () => {
      window.removeEventListener(GOOGLE_CONSENT_EVENT, sync);
      window.removeEventListener('focus', sync);
    };
  }, [pathname]);

  useEffect(() => {
    if (!allowed || isGA4AdminPath(pathname)) return;
    const frame = window.requestAnimationFrame(() => trackGA4PageView());
    return () => window.cancelAnimationFrame(frame);
  }, [allowed, pathname, search]);

  useEffect(() => {
    if (allowed && status === 'authenticated' && session?.user?.type === 'customer') completeGA4GoogleLogin();
  }, [allowed, status, session?.user?.type, pathname]);

  if (!allowed || isGA4AdminPath(pathname)) return null;
  return <Script id="grovery-ga4-sdk" src={`https://www.googletagmanager.com/gtag/js?id=${GA4_MEASUREMENT_ID}`} strategy="afterInteractive" onReady={setGA4Ready} />;
}
