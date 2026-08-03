import dbConnect from '@/lib/db';
import Settings from '@/models/Settings';

export default async function AnnouncementBar() {
  await dbConnect();
  const settings = await Settings.findOne().lean();
  const threshold = settings?.freeShippingThreshold ?? 499;
  const announcementText = settings?.announcementText || `Free shipping on orders above ₹${threshold}`;

  const items = [
    `🎁 ${announcementText}`,
    `✨ Handcrafted gifts for every occasion`,
    `🚀 Fast & reliable delivery pan India`,
    `💝 Personalized gifts made with love`,
    `🎀 Exclusive combos & hampers`,
    `🌟 100% satisfaction guaranteed`,
  ];

  return (
    <div
      className="relative overflow-hidden py-2"
      style={{ background: 'linear-gradient(90deg, #1B44B8 0%, #2456D8 35%, #F47920 65%, #2456D8 85%, #1B44B8 100%)' }}
    >
      {/* Shimmer overlay */}
      <div className="absolute inset-0 pointer-events-none shimmer-sweep opacity-30" />
      <div className="announcement-scroll relative z-10 flex whitespace-nowrap">
        {[...Array(2)].map((_, rep) =>
          items.map((text, i) => (
            <span key={`${rep}-${i}`} className="mx-5 text-xs font-semibold text-white sm:mx-10 sm:text-sm">
              {text}
              <span className="mx-3 text-white/40 sm:mx-5">◆</span>
            </span>
          ))
        )}
      </div>
    </div>
  );
}
