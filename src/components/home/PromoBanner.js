import dbConnect from '@/lib/db';
import Settings from '@/models/Settings';
import PromoCountdown from './PromoCountdown';

export default async function PromoBanner() {
  await dbConnect();
  const settings = await Settings.findOne().lean();

  if (settings?.promoEnabled === false) return null;

  return (
    <PromoCountdown
      title={settings?.promoTitle || 'Limited Time Offer!'}
      subtitle={settings?.promoSubtitle || "Hurry! Sale ends soon. Don't miss out on amazing deals."}
      buttonText={settings?.promoButtonText || 'Shop Now'}
      buttonLink={settings?.promoButtonLink || '/shop'}
      endsAt={settings?.promoEndsAt}
    />
  );
}
