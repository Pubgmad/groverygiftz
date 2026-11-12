import { notFound } from 'next/navigation';

/**
 * Dev-only routes under /dev/* are blocked in production deployments.
 * Unlock only with the non-public PREVIEW3D_BENCH=1 env var at process runtime
 * (never rely on NEXT_PUBLIC_* — those can be inlined at build time).
 */
export default function DevLayout({ children }) {
  const allowBench = process.env.PREVIEW3D_BENCH === '1';
  if (process.env.NODE_ENV === 'production' && !allowBench) {
    notFound();
  }
  return children;
}
