import dbConnect from '@/lib/db';
import Settings from '@/models/Settings';
import PromoCountdown from './PromoCountdown';

export default async function PromoBanner() {
  let settings = null;
  try {
    await dbConnect();
    settings = await Settings.findOne().lean();
  } catch {
    return null;
  }

  if (settings?.promoEnabled === false) return null;
  const buttonLink = !settings?.promoButtonLink || settings.promoButtonLink === '/shop'
    ? '/shop?view=offers'
    : settings.promoButtonLink;

  return (
    <PromoCountdown
      title={settings?.promoTitle || 'Limited Time Offer!'}
      subtitle={settings?.promoSubtitle || "Hurry! Sale ends soon. Don't miss out on amazing deals."}
      buttonText={settings?.promoButtonText || 'Shop Now'}
      buttonLink={buttonLink}
      endsAt={settings?.promoEndsAt}
    />
  );
}
