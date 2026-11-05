'use client';

import { useMemo } from 'react';
import { FiAward, FiHeart, FiStar, FiUsers } from 'react-icons/fi';

const ICONS = {
  spark: FiAward,
  users: FiUsers,
  star: FiStar,
  heart: FiHeart,
  award: FiAward,
};

function gridClassForCount(count) {
  if (count <= 1) return 'grid-cols-1 max-w-sm';
  if (count === 2) return 'grid-cols-2';
  if (count === 3) return 'grid-cols-1 sm:grid-cols-3';
  return 'grid-cols-2 lg:grid-cols-4';
}

export default function ProductTrustStats({ settings }) {
  const config = settings?.productTrustStats || {};
  const items = useMemo(() => {
    if (config.enabled === false) return [];
    return (config.items || [])
      .filter((item) => item?.isActive !== false && String(item?.value || '').trim() && String(item?.label || '').trim())
      .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
  }, [config.enabled, config.items]);

  if (items.length === 0) return null;
  const heading = String(config.heading || '').trim();

  return (
    <section
      className="rounded-2xl border border-primary-100 bg-gradient-to-br from-primary-50 via-white to-accent-50/50 p-4 sm:p-5 md:p-6"
      aria-label={heading || 'Business achievements'}
    >
      {heading ? (
        <h2 className="mb-4 font-display text-xl font-bold tracking-tight text-primary-900 sm:mb-5 sm:text-2xl">
          {heading}
        </h2>
      ) : null}
      <div className={`grid gap-3 sm:gap-3.5 ${gridClassForCount(items.length)}`}>
        {items.map((item, index) => {
          const Icon = ICONS[item.icon] || FiAward;
          return (
            <article
              key={`${item.label}-${index}`}
              className="flex h-full flex-col rounded-2xl bg-primary-800 px-4 py-4 text-left shadow-brand sm:px-5 sm:py-5"
            >
              <span className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-accent-300">
                <Icon size={18} aria-hidden />
              </span>
              <p className="font-display text-2xl font-bold leading-tight tracking-tight text-white sm:text-[1.75rem]">
                {item.value}
              </p>
              <p className="mt-1.5 text-xs font-medium leading-5 text-primary-100 sm:text-sm">
                {item.label}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
