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
    <section className="mt-10 rounded-[1.75rem] border border-primary-100 bg-gradient-to-br from-primary-50/80 via-white to-accent-50/40 p-4 sm:p-6" aria-label={heading || 'Business achievements'}>
      {heading ? (
        <h2 className="mb-4 font-display text-xl font-bold text-primary-900 sm:text-2xl">{heading}</h2>
      ) : null}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {items.map((item, index) => {
          const Icon = ICONS[item.icon] || FiAward;
          return (
            <div
              key={`${item.label}-${index}`}
              className="rounded-2xl border border-primary-900/10 bg-primary-950 px-4 py-5 text-center text-primary-50 shadow-sm"
            >
              <Icon size={18} className="mx-auto mb-2 text-accent-400" aria-hidden />
              <p className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{item.value}</p>
              <p className="mt-1 text-xs font-medium leading-5 text-primary-100/90 sm:text-sm">{item.label}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
