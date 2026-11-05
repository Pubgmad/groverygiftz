'use client';

import { useId, useMemo, useState } from 'react';
import { FiChevronDown, FiHelpCircle } from 'react-icons/fi';
import { hasRichTextContent, sanitizeRichHtml } from '@/lib/sanitizeRichHtml';

function AccordionRow({ id, title, open, onToggle, children }) {
  const panelId = `${id}-panel`;
  const buttonId = `${id}-button`;
  return (
    <div className="border-b border-primary-100/80 last:border-b-0">
      <h3 className="m-0">
        <button
          id={buttonId}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex min-h-12 w-full items-center gap-3 px-1 py-3.5 text-left transition-colors hover:bg-primary-50/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-200"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-700">
            <FiHelpCircle size={15} aria-hidden />
          </span>
          <span className="min-w-0 flex-1 text-sm font-bold text-gray-950 sm:text-[15px]">{title}</span>
          <FiChevronDown
            size={18}
            className={`shrink-0 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180 text-primary-600' : ''}`}
            aria-hidden
          />
        </button>
      </h3>
      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        aria-hidden={!open}
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className={`px-1 pb-4 pl-12 text-sm leading-6 text-gray-600 ${open ? '' : 'pointer-events-none'}`}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function normalizeFaqs(list = []) {
  return (Array.isArray(list) ? list : [])
    .filter((faq) => faq?.isActive !== false && String(faq?.question || '').trim() && hasRichTextContent(faq?.answer))
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
}

export default function ProductFaqs({ product, settings }) {
  const baseId = useId();
  const faqs = useMemo(() => {
    const globalFaqs = normalizeFaqs(settings?.productFaqs);
    if (globalFaqs.length > 0) return globalFaqs;
    return normalizeFaqs(product?.faqs);
  }, [product?.faqs, settings?.productFaqs]);

  const [openKey, setOpenKey] = useState('');

  if (faqs.length === 0) return null;

  return (
    <section
      className="overflow-hidden rounded-2xl border border-primary-100 bg-white shadow-sm"
      aria-labelledby={`${baseId}-heading`}
    >
      <div className="border-b border-primary-50 bg-gradient-to-r from-primary-50/80 to-white px-4 py-4 sm:px-5">
        <h2 id={`${baseId}-heading`} className="font-display text-lg font-bold text-primary-900 sm:text-xl">
          Frequently Asked Questions
        </h2>
        <p className="mt-1 text-xs text-gray-500 sm:text-sm">Answers to common questions before you order.</p>
      </div>
      <div className="px-3 sm:px-4">
        {faqs.map((faq, index) => {
          const key = `faq-${index}`;
          return (
            <AccordionRow
              key={key}
              id={`${baseId}-${key}`}
              title={String(faq.question).trim()}
              open={openKey === key}
              onToggle={() => setOpenKey((current) => (current === key ? '' : key))}
            >
              <div className="mx-auto w-full max-w-prose text-left">
                <div
                  className="prose prose-sm max-w-none break-words text-left text-gray-600 [&_a]:text-primary-700 [&_a]:underline"
                  dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(faq.answer) }}
                />
              </div>
            </AccordionRow>
          );
        })}
      </div>
    </section>
  );
}
