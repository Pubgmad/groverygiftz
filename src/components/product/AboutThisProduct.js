'use client';

import { useId, useMemo, useState } from 'react';
import { FiBookOpen, FiChevronDown, FiInfo, FiTruck } from 'react-icons/fi';
import { getDeliveryEstimateDisplay } from '@/lib/deliveryEstimateDisplay';
import { formatPrice } from '@/lib/utils';

function hasHtmlContent(value) {
  const text = String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .trim();
  return text.length > 0;
}

function AccordionRow({ id, title, icon, open, onToggle, children }) {
  const panelId = `${id}-panel`;
  const buttonId = `${id}-button`;
  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <h3 className="m-0">
        <button
          id={buttonId}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex min-h-12 w-full items-center gap-3 px-1 py-3 text-left transition-colors hover:bg-primary-50/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-200"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-700">
            {icon}
          </span>
          <span className="min-w-0 flex-1 text-sm font-bold text-gray-950">{title}</span>
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
          <div className={`px-1 pb-4 pl-12 text-sm leading-6 text-gray-600 ${open ? '' : 'pointer-events-none'}`}>{children}</div>
        </div>
      </div>
    </div>
  );
}

export default function AboutThisProduct({
  product,
  settings,
  selectedDeliveryState = '',
  selectedDelivery = null,
}) {
  const baseId = useId();
  const about = product?.aboutThisProduct || {};
  const descriptionHtml = String(product?.description || '');
  const instructionsText = String(about.instructions || product?.customizationPreview?.instructions || '').trim();
  const deliveryNotes = String(about.deliveryNotes || '').trim();
  const estimate = useMemo(
    () => getDeliveryEstimateDisplay(settings, selectedDeliveryState),
    [settings, selectedDeliveryState]
  );

  const sections = useMemo(() => {
    const next = [];
    if (!about.hideDescription && hasHtmlContent(descriptionHtml)) {
      next.push({
        key: 'description',
        title: 'Description',
        icon: <FiInfo size={15} />,
        body: (
          <div
            className="prose prose-sm max-w-none break-words text-gray-600 [&_img]:max-w-full [&_table]:block [&_table]:w-full [&_table]:overflow-x-auto"
            dangerouslySetInnerHTML={{ __html: descriptionHtml }}
          />
        ),
      });
    }
    if (!about.hideInstructions && instructionsText) {
      next.push({
        key: 'instructions',
        title: 'Instructions',
        icon: <FiBookOpen size={15} />,
        body: <p className="whitespace-pre-wrap break-words">{instructionsText}</p>,
      });
    }
    if (!about.hideDelivery) {
      next.push({
        key: 'delivery',
        title: 'Delivery Information',
        icon: <FiTruck size={15} />,
        body: (
          <div className="space-y-2">
            {estimate.status === 'ready' ? (
              <>
                <p>
                  <span className="font-semibold text-gray-800">Estimated delivery: </span>
                  {estimate.durationLabel}
                  {estimate.expectedByLabel ? ` · Expected by ${estimate.expectedByLabel}` : ''}
                </p>
                {estimate.fullText ? <p className="text-xs text-gray-500">{estimate.fullText}</p> : null}
              </>
            ) : (
              <p>{estimate.disclaimer}</p>
            )}
            {selectedDeliveryState && selectedDelivery ? (
              <p>
                <span className="font-semibold text-gray-800">Delivery charge for {selectedDeliveryState}: </span>
                {Number(selectedDelivery.cost) === 0 ? 'FREE' : formatPrice(selectedDelivery.cost)}
              </p>
            ) : null}
            {deliveryNotes ? <p className="whitespace-pre-wrap break-words">{deliveryNotes}</p> : null}
            {estimate.status === 'ready' ? <p className="text-xs text-gray-500">{estimate.disclaimer}</p> : null}
          </div>
        ),
      });
    }
    return next;
  }, [about.hideDelivery, about.hideDescription, about.hideInstructions, deliveryNotes, descriptionHtml, estimate, instructionsText, selectedDelivery, selectedDeliveryState]);

  const [openKey, setOpenKey] = useState('');

  if (sections.length === 0) return null;

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white" aria-labelledby={`${baseId}-heading`}>
      <div className="border-b border-gray-100 px-4 py-3">
        <h2 id={`${baseId}-heading`} className="font-display text-base font-bold text-gray-950">
          About This Product
        </h2>
        <p className="mt-0.5 text-xs text-gray-500">Product details managed by the store admin</p>
      </div>
      <div className="px-3 sm:px-4">
        {sections.map((section) => (
          <AccordionRow
            key={section.key}
            id={`${baseId}-${section.key}`}
            title={section.title}
            icon={section.icon}
            open={openKey === section.key}
            onToggle={() => setOpenKey((current) => (current === section.key ? '' : section.key))}
          >
            {section.body}
          </AccordionRow>
        ))}
      </div>
    </section>
  );
}
