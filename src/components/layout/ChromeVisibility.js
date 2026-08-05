'use client';
import { usePathname } from 'next/navigation';

const isAdminPath = (pathname = '') => pathname.startsWith('/admin') || pathname.startsWith('/account/manage');

export default function ChromeVisibility({ children }) {
  const pathname = usePathname();
  if (isAdminPath(pathname)) return null;
  return children;
}
