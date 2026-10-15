'use client';

import { useEffect } from 'react';
import { trackGA4Search } from '@/lib/ga4';

export default function GA4SearchTracker({ query, products }) {
  useEffect(() => {
    trackGA4Search(query, products);
  }, [query, products]);

  return null;
}
