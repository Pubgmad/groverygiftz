'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FiCheckCircle, FiShield, FiX, FiXCircle } from 'react-icons/fi';
import { REPLACEMENT_WARRANTY as policy } from '@/lib/replacementWarrantyPolicy';

export default function ReplacementWarrantyModal({ open, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    document.body.classList.add('warranty-modal-open');
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('warranty-modal-open');
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[96] flex items-end justify-center bg-gray-950/50 p-3 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="replacement-warranty-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        className="flex max-h-[min(92dvh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <header className="shrink-0 bg-primary-600 px-5 py-4 text-white">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15">
              <FiShield size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id="replacement-warranty-title" className="font-display text-lg font-bold leading-snug">
                {policy.title}
              </h2>
              <p className="mt-0.5 text-sm text-primary-100">{policy.subtitle}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
              aria-label="Close replacement policy"
            >
              <FiX size={20} />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4">
          <p className="text-sm leading-6 text-gray-600">{policy.intro}</p>

          <section className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
            <h3 className="flex items-center gap-2 text-sm font-bold text-emerald-900">
              <FiCheckCircle className="shrink-0 text-emerald-600" size={16} />
              {policy.eligibleTitle}
            </h3>
            <p className="mt-2 text-xs leading-5 text-emerald-900/80">{policy.eligibleIntro}</p>
            <ul className="mt-3 space-y-2">
              {policy.eligible.map((item) => (
                <li key={item} className="flex gap-2 text-sm leading-5 text-emerald-950">
                  <FiCheckCircle className="mt-0.5 shrink-0 text-emerald-600" size={15} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-rose-100 bg-rose-50/70 p-4">
            <h3 className="flex items-center gap-2 text-sm font-bold text-rose-900">
              <FiXCircle className="shrink-0 text-rose-500" size={16} />
              {policy.ineligibleTitle}
            </h3>
            <p className="mt-2 text-xs leading-5 text-rose-900/80">{policy.ineligibleIntro}</p>
            <ul className="mt-3 space-y-2">
              {policy.ineligible.map((item) => (
                <li key={item} className="flex gap-2 text-sm leading-5 text-rose-950">
                  <FiXCircle className="mt-0.5 shrink-0 text-rose-500" size={15} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-primary-100 bg-primary-50/60 p-4">
            <h3 className="text-sm font-bold text-primary-900">{policy.requestTitle}</h3>
            <ol className="mt-3 space-y-2.5">
              {policy.requestSteps.map((step, index) => (
                <li key={step} className="flex gap-3 text-sm leading-5 text-gray-800">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white">
                    {index + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="rounded-2xl border border-amber-100 bg-amber-50/80 p-4">
            <h3 className="text-sm font-bold text-amber-950">{policy.notesTitle}</h3>
            <ul className="mt-2 space-y-1.5 text-sm leading-5 text-amber-950/90">
              {policy.notes.map((note) => (
                <li key={note}>• {note}</li>
              ))}
            </ul>
          </section>

          <p className="text-center text-sm font-semibold text-primary-700">{policy.closing}</p>
        </div>

        <div className="shrink-0 border-t border-gray-100 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-primary-600 text-sm font-bold text-white hover:bg-primary-700"
          >
            Got It
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
