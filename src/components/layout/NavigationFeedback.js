'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

const NAVIGATION_EVENT = 'groverygiftz:navigation-start';
const NAVIGATION_TIMEOUT = 10000;

export function startNavigationFeedback() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(NAVIGATION_EVENT));
}

export default function NavigationFeedback() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = useMemo(() => `${pathname}?${searchParams?.toString() || ''}`, [pathname, searchParams]);
  const [pending, setPending] = useState(false);
  const timeoutRef = useRef(null);

  useEffect(() => {
    const clearPending = () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      setPending(false);
    };

    const startPending = () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      setPending(true);
      timeoutRef.current = window.setTimeout(clearPending, NAVIGATION_TIMEOUT);
    };

    window.addEventListener(NAVIGATION_EVENT, startPending);
    return () => {
      window.removeEventListener(NAVIGATION_EVENT, startPending);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!pending) return undefined;
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    setPending(false);
    return undefined;
  }, [routeKey]);

  useEffect(() => {
    const handleDocumentClick = (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (event.target?.closest?.('button, input, select, textarea, [role="button"]')) return;
      const anchor = event.target?.closest?.('a[href]');
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;

      const rawHref = anchor.getAttribute('href');
      if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:')) return;
      const destination = new URL(rawHref, window.location.href);
      if (destination.origin !== window.location.origin) return;
      const current = `${window.location.pathname}${window.location.search}`;
      const next = `${destination.pathname}${destination.search}`;
      if (current === next) return;
      startNavigationFeedback();
    };

    document.addEventListener('click', handleDocumentClick, true);
    return () => document.removeEventListener('click', handleDocumentClick, true);
  }, []);

  if (!pending) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[200] h-1 bg-primary-100/70" role="status" aria-live="polite" aria-label="Loading">
      <div className="h-full w-1/3 animate-pulse rounded-r-full bg-primary-600" />
      <span className="sr-only">Loading page</span>
    </div>
  );
}