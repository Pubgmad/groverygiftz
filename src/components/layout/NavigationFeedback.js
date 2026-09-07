'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

const isAdminPath = (pathname = '') => pathname.startsWith('/admin') || pathname.startsWith('/account/manage');
const isModifiedClick = (event) => event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;

export default function NavigationFeedback() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);
  const timeoutRef = useRef(null);

  useEffect(() => {
    setLoading(false);
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
  }, [pathname]);

  useEffect(() => {
    if (isAdminPath(pathname)) return undefined;

    const stopLater = () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => setLoading(false), 10000);
    };

    const handleClick = (event) => {
      if (event.defaultPrevented || isModifiedClick(event)) return;
      const anchor = event.target?.closest?.('a[href]');
      if (!anchor) return;
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download')) return;
      const href = anchor.getAttribute('href') || '';
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('https://wa.me/')) return;

      let nextUrl;
      try {
        nextUrl = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (nextUrl.origin !== window.location.origin) return;
      if (nextUrl.pathname === window.location.pathname && nextUrl.search === window.location.search && nextUrl.hash) return;

      setLoading(true);
      stopLater();
    };

    document.addEventListener('click', handleClick, true);
    return () => {
      document.removeEventListener('click', handleClick, true);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, [pathname]);

  if (!loading || isAdminPath(pathname)) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[120]">
      <div className="h-1 w-full overflow-hidden bg-primary-100">
        <div className="h-full w-1/3 animate-[navigation-progress_1s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-primary-600 via-accent-500 to-primary-600" />
      </div>
      <div className="mx-auto mt-3 flex w-fit items-center gap-2 rounded-full bg-gray-950/90 px-4 py-2 text-xs font-bold text-white shadow-lg backdrop-blur-sm">
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
        Loading...
      </div>
    </div>
  );
}
