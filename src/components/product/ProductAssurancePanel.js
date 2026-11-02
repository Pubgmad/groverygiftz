'use client';

import { useMemo, useState } from 'react';
import { FiCalendar, FiInfo, FiShield, FiTruck } from 'react-icons/fi';
import { getDeliveryEstimateDisplay } from '@/lib/deliveryEstimateDisplay';
import { REPLACEMENT_WARRANTY } from '@/lib/replacementWarrantyPolicy';
import ReplacementWarrantyModal from '@/components/product/ReplacementWarrantyModal';

export default function ProductAssurancePanel({ settings, selectedDeliveryState }) {
  const [warrantyOpen, setWarrantyOpen] = useState(false);
  const estimate = useMemo(
    () => getDeliveryEstimateDisplay(settings, selectedDeliveryState),
    [settings, selectedDeliveryState]
  );

  return (
    <>
      <section className="mb-6 overflow-hidden rounded-2xl border border-primary-100 bg-gradient-to-br from-primary-50/90 via-white to-accent-50/40 shadow-sm">
        <div className="border-b border-primary-100/80 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-600 text-white">
              <FiTruck size={15} />
            </span>
            <div className="min-w-0">
              <h2 className="font-display text-sm font-bold text-gray-950">Estimated Delivery</h2>
              <p className="text-[11px] text-gray-500">
                {selectedDeliveryState ? `For ${selectedDeliveryState}` : 'Based on your selected delivery state'}
              </p>
            </div>
          </div>
        </div>

        <div className="px-4 py-4">
          {estimate.status === 'ready' ? (
            <div className="rounded-2xl border border-primary-200/80 bg-white px-4 py-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">Delivery window</p>
                  <p className="mt-1 font-display text-xl font-bold leading-tight text-primary-800 sm:text-2xl">
                    {estimate.durationLabel}
                  </p>
                </div>
                {estimate.expectedByLabel ? (
                  <div className="min-w-0 rounded-xl bg-primary-50 px-3 py-2">
                    <p className="flex items-center gap-1.5 text-[11px] font-semibold text-primary-700">
                      <FiCalendar size={12} />
                      Expected by
                    </p>
                    <p className="mt-0.5 text-sm font-bold text-gray-900">{estimate.expectedByLabel}</p>
                  </div>
                ) : null}
              </div>
              <p className="mt-3 flex gap-2 text-xs leading-5 text-gray-500">
                <FiInfo className="mt-0.5 shrink-0 text-primary-500" size={13} />
                <span>{estimate.disclaimer}</span>
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-primary-200 bg-white/80 px-4 py-4">
              <p className="text-sm font-semibold text-gray-800">
                {estimate.status === 'need-state' ? 'Select a delivery state' : 'Estimate unavailable'}
              </p>
              <p className="mt-1 text-xs leading-5 text-gray-500">{estimate.disclaimer}</p>
            </div>
          )}
        </div>

        <div className="border-t border-primary-100/80 px-4 py-3">
          <div className="flex flex-col gap-3 rounded-2xl border border-accent-100 bg-white/90 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-50 text-accent-600">
                <FiShield size={16} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-950">{REPLACEMENT_WARRANTY.title}</p>
                <p className="text-xs text-gray-500">{REPLACEMENT_WARRANTY.subtitle}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setWarrantyOpen(true)}
              className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-primary-600 px-4 text-sm font-bold text-white hover:bg-primary-700"
            >
              View Replacement Policy
            </button>
          </div>
        </div>
      </section>

      <ReplacementWarrantyModal open={warrantyOpen} onClose={() => setWarrantyOpen(false)} />
    </>
  );
}
