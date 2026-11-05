'use client';

import { useEffect, useRef, useState } from 'react';
import { FiEye } from 'react-icons/fi';
import {
  formatInterestLabel,
  generateProductInterestEstimate,
  nextInterestPace,
  nudgeInterestEstimate,
} from '@/lib/productInterest';

/**
 * Live-style product views counter with fluctuating fast/slow pacing.
 */
export default function ProductInterestIndicator({ product }) {
  const config = product?.productInterest || {};
  if (config.enabled === false) return null;

  const productId = product?._id || product?.slug || product?.title || 'product';
  const [displayCount, setDisplayCount] = useState(null);
  const [animating, setAnimating] = useState(false);
  const currentRef = useRef(null);
  const timerRef = useRef(null);
  const paceUntilRef = useRef(0);
  const paceRef = useRef(nextInterestPace());

  useEffect(() => {
    const next = generateProductInterestEstimate(productId, config);
    currentRef.current = next;
    setDisplayCount(next);
    setAnimating(true);
    const t = setTimeout(() => setAnimating(false), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- new value on each product mount / remount (refresh)
  }, [productId]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return undefined;

    const schedule = () => {
      const now = Date.now();
      if (now >= paceUntilRef.current) {
        paceRef.current = nextInterestPace();
        // Stay in this pace for a short burst window
        const hold = paceRef.current.mode === 'burst'
          ? 900 + Math.floor(Math.random() * 1400)
          : paceRef.current.mode === 'slow'
            ? 1600 + Math.floor(Math.random() * 2200)
            : 1200 + Math.floor(Math.random() * 1800);
        paceUntilRef.current = now + hold;
      }

      const pace = paceRef.current;
      if (currentRef.current != null) {
        const next = nudgeInterestEstimate(currentRef.current, config, pace.mode);
        if (next !== currentRef.current) {
          currentRef.current = next;
          setDisplayCount(next);
          setAnimating(true);
        }
      }

      timerRef.current = setTimeout(schedule, pace.delayMs);
    };

    timerRef.current = setTimeout(schedule, 80);
    const clearAnim = setInterval(() => setAnimating(false), 280);

    return () => {
      clearTimeout(timerRef.current);
      clearInterval(clearAnim);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  if (displayCount == null) return null;

  return (
    <div
      className={`product-interest ${animating ? 'product-interest--tick' : ''} w-full min-w-0 sm:w-auto`}
      role="status"
      aria-live="off"
    >
      <span className="product-interest__icon" aria-hidden>
        <FiEye size={14} />
      </span>
      <span className="product-interest__text min-w-0 leading-snug">
        {formatInterestLabel(displayCount, config)}
      </span>
    </div>
  );
}
