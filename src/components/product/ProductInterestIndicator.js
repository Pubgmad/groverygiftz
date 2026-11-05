'use client';

import { useEffect, useRef, useState } from 'react';
import { FiEye } from 'react-icons/fi';
import {
  formatInterestLabel,
  generateProductInterestEstimate,
  nextInterestPace,
  nudgeInterestEstimate,
} from '@/lib/productInterest';
import { isProductSoldOut } from '@/lib/stock';

/**
 * Live-style product views counter with natural fluctuating pace.
 * When stock is over, the count stays very low but still fluctuates.
 */
export default function ProductInterestIndicator({ product }) {
  const config = product?.productInterest || {};
  if (config.enabled === false) return null;

  const productId = product?._id || product?.slug || product?.title || 'product';
  const soldOut = isProductSoldOut(product);
  const [displayCount, setDisplayCount] = useState(null);
  const [animating, setAnimating] = useState(false);
  const currentRef = useRef(null);
  const timerRef = useRef(null);
  const paceUntilRef = useRef(0);
  const paceRef = useRef(nextInterestPace());
  const soldOutRef = useRef(soldOut);

  useEffect(() => {
    soldOutRef.current = soldOut;
    const next = generateProductInterestEstimate(productId, config, { soldOut });
    currentRef.current = next;
    setDisplayCount(next);
    setAnimating(true);
    const t = setTimeout(() => setAnimating(false), 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh estimate when product or stock state changes
  }, [productId, soldOut]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return undefined;

    const schedule = () => {
      const now = Date.now();
      if (now >= paceUntilRef.current) {
        paceRef.current = nextInterestPace();
        const hold = paceRef.current.mode === 'quicker'
          ? 4000 + Math.floor(Math.random() * 4000)
          : paceRef.current.mode === 'slow'
            ? 8000 + Math.floor(Math.random() * 8000)
            : 6000 + Math.floor(Math.random() * 6000);
        paceUntilRef.current = now + hold;
      }

      const pace = paceRef.current;
      if (currentRef.current != null) {
        const next = nudgeInterestEstimate(
          currentRef.current,
          config,
          pace.mode,
          { soldOut: soldOutRef.current },
        );
        if (next !== currentRef.current) {
          currentRef.current = next;
          setDisplayCount(next);
          setAnimating(true);
          setTimeout(() => setAnimating(false), 450);
        }
      }

      timerRef.current = setTimeout(schedule, pace.delayMs);
    };

    timerRef.current = setTimeout(schedule, 2500 + Math.floor(Math.random() * 1500));

    return () => {
      clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, soldOut]);

  if (displayCount == null) return null;

  return (
    <div
      className={`product-interest ${animating ? 'product-interest--tick' : ''} w-full min-w-0 sm:w-auto`}
      role="status"
      aria-live="polite"
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
