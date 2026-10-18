'use client';

import useDeliverySettings from '@/hooks/useDeliverySettings';
import { getCentralDeliveryEstimate } from '@/lib/centralDeliveryEstimates';

export default function DeliveryEstimateSummary() {
  const settings = useDeliverySettings();
  return (
    <section className="mb-6 border-b pb-5 text-sm" aria-label="Current estimated delivery days">
      <dl className="grid gap-4 sm:grid-cols-2">
        <div><dt className="font-semibold text-gray-900">Tamil Nadu</dt><dd className="mt-1 break-words text-gray-600">{getCentralDeliveryEstimate(settings, 'Tamil Nadu') || 'Loading delivery estimate...'}</dd></div>
        <div><dt className="font-semibold text-gray-900">Other supported states and union territories</dt><dd className="mt-1 break-words text-gray-600">{getCentralDeliveryEstimate(settings, 'Kerala') || 'Loading delivery estimate...'}</dd></div>
      </dl>
    </section>
  );
}
