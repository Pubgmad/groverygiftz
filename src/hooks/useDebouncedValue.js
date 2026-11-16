'use client';

import { useEffect, useState } from 'react';

/** Debounce a rapidly changing value (e.g. Admin search fields) before querying. */
export default function useDebouncedValue(value, delayMs = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
