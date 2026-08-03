'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FiArrowRight, FiClock } from 'react-icons/fi';

function toTimeParts(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / (60 * 60 * 24));
  const hours = Math.floor((total % (60 * 60 * 24)) / (60 * 60));
  const minutes = Math.floor((total % (60 * 60)) / 60);
  const seconds = total % 60;
  return { days, hours, minutes, seconds };
}

export default function PromoCountdown({ title, subtitle, buttonText, buttonLink, endsAt }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const remaining = useMemo(() => {
    if (!endsAt) return null;
    const ts = new Date(endsAt).getTime();
    if (Number.isNaN(ts)) return null;
    return Math.max(0, ts - now);
  }, [endsAt, now]);

  const parts = remaining !== null ? toTimeParts(remaining) : null;
  const hasEnded = remaining !== null && remaining <= 0;

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 md:py-16">
      <div className="relative overflow-hidden rounded-3xl bg-primary-800 text-white">
        <div className="absolute inset-0 gift-paper-band opacity-20" />
        <div className="relative z-10 px-4 py-10 text-center sm:px-6 sm:py-14 md:px-8 md:py-20">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/12 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-white backdrop-blur-sm">
            <FiClock size={14} /> Limited time offer
          </div>
          <h2 className="mb-4 text-2xl font-display font-extrabold drop-shadow-lg sm:text-3xl md:text-5xl">{title}</h2>
          <p className="mx-auto mb-8 max-w-2xl text-base text-white/85 md:text-xl">{subtitle}</p>
          {parts && (
            <div className="mx-auto mb-8 grid max-w-sm grid-cols-2 gap-3 sm:mb-10 sm:grid-cols-4">
              {[
                { label: 'Days', value: parts.days },
                { label: 'Hours', value: parts.hours },
                { label: 'Minutes', value: parts.minutes },
                { label: 'Seconds', value: parts.seconds },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-white/25 bg-white/18 py-3 shadow-lg backdrop-blur-sm">
                  <div className="text-2xl font-extrabold tabular-nums md:text-3xl">{String(item.value).padStart(2, '0')}</div>
                  <div className="mt-0.5 text-xs uppercase tracking-wide text-white/80">{item.label}</div>
                </div>
              ))}
            </div>
          )}
          {hasEnded ? (
            <p className="font-medium text-white/90">This offer has ended. Check back soon for new deals!</p>
          ) : (
            <Link href={buttonLink || '/shop'} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 text-base font-extrabold text-primary-700 shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent-50 hover:shadow-orange sm:w-auto sm:px-10 sm:py-4 sm:text-lg">
              {buttonText || 'Shop Now'} <FiArrowRight size={18} />
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
