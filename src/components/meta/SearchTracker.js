'use client';

import { useEffect, useRef } from 'react';
import { META_READY_EVENT, trackMetaEvent } from '@/lib/metaPixel';

export default function SearchTracker({ query, occasion, giftType, resultCount }) {
  const trackedKey = useRef('');
  const key = JSON.stringify({ query, occasion, giftType, resultCount });

  useEffect(() => {
    const track = () => {
      if (trackedKey.current === key || (!query && !occasion && !giftType)) return;
      if (trackMetaEvent('Search', {
      search_string: query || [occasion, giftType].filter(Boolean).join(' '),
      content_category: [occasion, giftType].filter(Boolean).join(' | '),
      result_count: Number(resultCount || 0),
      })) trackedKey.current = key;
    };
    track();
    window.addEventListener(META_READY_EVENT, track);
    return () => window.removeEventListener(META_READY_EVENT, track);
  }, [giftType, key, occasion, query, resultCount]);

  return null;
}
