'use client';

import { useEffect, useRef } from 'react';
import { trackMetaEvent } from '@/lib/metaPixel';

export default function SearchTracker({ query, occasion, giftType, resultCount }) {
  const trackedKey = useRef('');
  const key = JSON.stringify({ query, occasion, giftType, resultCount });

  useEffect(() => {
    if (trackedKey.current === key) return;
    if (!query && !occasion && !giftType) return;
    trackedKey.current = key;

    trackMetaEvent('Search', {
      search_string: query || [occasion, giftType].filter(Boolean).join(' '),
      content_category: [occasion, giftType].filter(Boolean).join(' | '),
      result_count: Number(resultCount || 0),
    });
  }, [giftType, key, occasion, query, resultCount]);

  return null;
}