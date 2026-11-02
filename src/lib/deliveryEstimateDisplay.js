import { buildCurrentDeliveryEstimate, getCentralDeliveryEstimate } from '@/lib/centralDeliveryEstimates';

/**
 * Presentation helper only — reuses existing estimate builders, never recalculates shipping.
 */
export function getDeliveryEstimateDisplay(settings, state) {
  const trimmedState = String(state || '').trim();
  if (!trimmedState) {
    return {
      status: 'need-state',
      durationLabel: '',
      expectedByLabel: '',
      fullText: 'Select state to see delivery estimate',
      disclaimer: 'Select your delivery state above to see the expected arrival window for this gift.',
    };
  }

  const durationLabel = getCentralDeliveryEstimate(settings, trimmedState);
  const fullText = buildCurrentDeliveryEstimate(settings, trimmedState);
  if (!durationLabel) {
    return {
      status: 'unavailable',
      durationLabel: '',
      expectedByLabel: '',
      fullText: fullText || 'Delivery estimate unavailable',
      disclaimer: 'A delivery estimate is not available for the selected state right now.',
    };
  }

  const expectedMatch = /expected by\s+(.+?)\s*\(/i.exec(fullText || '');
  return {
    status: 'ready',
    durationLabel,
    expectedByLabel: expectedMatch?.[1]?.trim() || '',
    fullText,
    disclaimer: 'Excluding Sundays and applicable government/public holidays. Actual delivery may vary with courier delays.',
  };
}
