import Settings from '@/models/Settings';
import { withDeliveryEstimateDefaults } from '@/lib/centralDeliveryEstimates';

export async function readDeliveryEstimateSettings() {
  const settings = await Settings.findOne().select('tamilNaduDeliveryEstimate otherStateDeliveryEstimate deliveryHolidays').lean();
  return withDeliveryEstimateDefaults(settings || {});
}
