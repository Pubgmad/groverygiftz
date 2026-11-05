'use client';

import { useEffect, useRef, useState } from 'react';
import { FiEye } from 'react-icons/fi';
import {
  formatInterestLabel,
  generateProductInterestEstimate,
  nudgeInterestEstimate,
} from '@/lib/productInterest';

/**
 * Promotional estimated product-interest indicator (not verified concurrent viewers).
 */
export default function ProductInterestIndicator({ product }) {
  const config = product?.productInterest || {};
  if (config.enabled === false) return null;

  const productId = product?._id || product?.slug || product?.title || 'product';
  const [displayCount, setDisplayCount] = useState(null);
  const [animating, setAnimating] = useState(false);
  const currentRef = useRef(null);
  const frameRef = useRef(null);

  useEffect(() => {
    const next = generateProductInterestEstimate(productId, config);
    currentRef.current = next;
    setDisplayCount(next);
    setAnimating(true);
    const t = setTimeout(() => setAnimating(false), 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh when product changes
  }, [productId]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return undefined;

    const animateTo = (next) => {
      const start = currentRef.current ?? next;
      if (start === next) return;
      currentRef.current = next;
      setAnimating(true);
      const diff = next - start;
      const steps = 8;
      let step = 0;
      cancelAnimationFrame(frameRef.current);
      const run = () => {
        step += 1;
        setDisplayCount(Math.round(start + (diff * step) / steps));
        if (step < steps) {
          frameRef.current = requestAnimationFrame(run);
        } else {
          setDisplayCount(next);
          setAnimating(false);
        }
      };
      frameRef.current = requestAnimationFrame(run);
    };

    const id = setInterval(() => {
      if (currentRef.current == null) return;
      animateTo(nudgeInterestEstimate(currentRef.current, config));
    }, 14000 + Math.floor(Math.random() * 6000));

    return () => {
      clearInterval(id);
      cancelAnimationFrame(frameRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

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
