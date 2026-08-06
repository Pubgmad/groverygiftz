import Link from 'next/link';
import { FiArrowRight } from 'react-icons/fi';

const COLLECTION_STYLES = [
  { gradient: 'from-rose-500 via-accent-500 to-primary-700', label: 'Love' },
  { gradient: 'from-amber-400 via-accent-500 to-primary-600', label: 'Joy' },
  { gradient: 'from-primary-700 via-sky-500 to-emerald-400', label: 'Gift' },
  { gradient: 'from-fuchsia-500 via-primary-600 to-accent-500', label: 'New' },
];

export default function CollectionsGrid({ collections = [], settings }) {
  if (!collections.length) return null;

  return (
    <section className="gift-section-soft px-4 py-16 md:py-20">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 flex flex-col gap-4 md:mb-12 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            {settings?.homeCollectionsEyebrow && <p className="section-eyebrow">{settings.homeCollectionsEyebrow}</p>}
            {settings?.homeCollectionsTitle && <h2 className="text-3xl font-display font-extrabold leading-tight text-gray-950 md:text-5xl">{settings.homeCollectionsTitle}</h2>}
            {settings?.homeCollectionsSubtitle && <p className="mt-4 max-w-xl text-gray-600">{settings.homeCollectionsSubtitle}</p>}
          </div>
          <Link href="/shop?view=collections" className="btn-outline inline-flex w-fit items-center gap-2 px-5 py-3">
            All gifts <FiArrowRight size={16} />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4 md:gap-6">
          {collections.map((col, idx) => {
            const style = COLLECTION_STYLES[idx % COLLECTION_STYLES.length];
            return (
              <Link
                key={col._id}
                href={`/collections/${col.slug}`}
                className="group relative aspect-[4/5] overflow-hidden rounded-2xl bg-white product-lift transition-all duration-300 hover:-translate-y-1"
              >
                {col.image ? (
                  <img src={col.image} alt={col.name} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
                ) : (
                  <div className={`relative flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-br ${style.gradient}`}>
                    <div className="absolute inset-0 gift-paper-band opacity-30" />
                    <span className="relative z-10 text-4xl font-display font-extrabold text-white/50 transition-transform duration-500 group-hover:scale-110 md:text-5xl">
                      {style.label}
                    </span>
                  </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black/86 via-black/28 to-transparent" />
                <div className="absolute left-3 right-3 top-3 flex items-start justify-between gap-2 sm:left-4 sm:right-4 sm:top-4">
                  <span className="ml-auto inline-flex shrink-0 items-center justify-center rounded-full bg-accent-500 px-3 py-1.5 text-[10px] font-extrabold uppercase leading-none tracking-wide text-white shadow-sm sm:text-[11px]">
                    Curated
                  </span>
                </div>

                <div className="absolute inset-x-0 bottom-0 p-4 md:p-5">
                  <h3 className="text-lg font-display font-extrabold leading-tight text-white drop-shadow-[0_3px_8px_rgba(0,0,0,0.95)] md:text-xl">{col.name}</h3>
                  <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-extrabold text-primary-700 shadow-md transition-all duration-300 group-hover:bg-accent-500 group-hover:text-white md:text-sm">
                    {settings?.homeCollectionsButtonText || 'Shop gifts'} <FiArrowRight size={14} />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
