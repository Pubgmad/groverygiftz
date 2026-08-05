import Link from 'next/link';

export default function HotspotBanner({ image, products = [], title }) {
  const spots = products.filter((spot) => spot?.label);
  if (!image && spots.length === 0 && !title) return null;

  return (
    <section className="max-w-7xl mx-auto px-4 py-12 md:py-16">
      {title && <h2 className="section-title text-center mb-8">{title}</h2>}
      <div className="relative rounded-2xl overflow-hidden">
        {image ? (
          <img src={image} alt={title || 'Featured gift banner'} className="w-full aspect-[2/1] object-cover" />
        ) : (
          <div className="w-full aspect-[2/1] relative overflow-hidden flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #F47920 0%, #F27A1A 50%, #D96212 100%)' }}>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(255,255,255,0.16),transparent_30%),radial-gradient(circle_at_75%_70%,rgba(255,255,255,0.12),transparent_28%)]" />
          </div>
        )}
        {spots.map((spot, idx) => (
          <Link key={idx} href={spot.href || '/shop'} className="absolute group" style={{ top: spot.top, left: spot.left }}>
            <span className="relative flex h-6 w-6">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-6 w-6 bg-accent-600 border-2 border-white shadow-lg" />
            </span>
            <span className="absolute left-8 top-0 hidden max-w-[180px] bg-white text-gray-900 px-3 py-1.5 rounded-lg shadow-lg text-sm font-medium opacity-0 transition-opacity group-hover:opacity-100 sm:block">
              {spot.label}
              <span className="text-accent-600 ml-1">-&gt;</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
