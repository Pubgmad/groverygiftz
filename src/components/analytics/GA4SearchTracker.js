'use client';

import { useEffect } from 'react';
import { trackGA4Search } from '@/lib/ga4';
import { GOOGLE_CONSENT_SYNC_EVENT } from '@/lib/googleConsent';

export default function GA4SearchTracker({ query, products }) {
  useEffect(() => {
    const track = () => trackGA4Search(query, products);
    track();
    window.addEventListener(GOOGLE_CONSENT_SYNC_EVENT, track);
    return () => window.removeEventListener(GOOGLE_CONSENT_SYNC_EVENT, track);
  }, [query, products]);

  return null;
}
