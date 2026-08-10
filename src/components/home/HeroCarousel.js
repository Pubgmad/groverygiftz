'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FiChevronLeft, FiChevronRight, FiTruck, FiGift, FiStar, FiShoppingBag, FiShield } from 'react-icons/fi';
import { trackMetaCustomEvent } from '@/lib/metaPixel';

const TRUST_ICONS = [FiTruck, FiGift, FiShield, FiStar];

export default function HeroCarousel({ banners = [], settings }) {
  const [current, setCurrent] = useState(0);
  const [key, setKey] = useState(0);
  const router = useRouter();
  const slides = banners.filter((banner) => banner?.title || banner?.image);
  const trustBadges = (settings?.heroTrustBadges || []).map((badge) => badge?.trim()).filter(Boolean);
  const fallbackTitle = settings?.heroFallbackTitle || 'Personalized Gifts Made With Love';
  const fallbackSubtitle = settings?.heroFallbackSubtitle || 'Create memorable photo frames, LED lamps, engravings and custom gifts for every occasion.';
  const fallbackButtonText = settings?.heroFallbackButtonText || 'Shop gifts';
  const touchStartX = useRef(null);
  const touchEndX = useRef(null);
  const handleTouchStart = (event) => { touchStartX.current = event.touches?.[0]?.clientX ?? null; };
  const handleTouchMove = (event) => { touchEndX.current = event.touches?.[0]?.clientX ?? null; };
  const handleTouchEnd = () => {
    if (slides.length <= 1 || touchStartX.current === null || touchEndX.current === null) return;
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 45) goTo(diff > 0 ? (current + 1) % slides.length : (current - 1 + slides.length) % slides.length);
    touchStartX.current = null;
    touchEndX.current = null;
  };


  if (slides.length === 0) return null;

  const goTo = (idx) => {
    setCurrent(idx);
    setKey((k) => k + 1);
  };
  const trackBannerClick = (slide) => {
    trackMetaCustomEvent('BannerClick', {
      banner_title: slide.title || fallbackTitle,
      banner_link: slide.link || '/shop',
      banner_location: 'hero',
    });
  };

  const openBanner = (slide, event) => {
    if (event?.target?.closest?.('a,button,input,select,textarea,video')) return;
    trackBannerClick(slide);
    router.push(slide.link || '/shop');
  };

  return (
    <section className="relative min-h-[520px] overflow-hidden sm:min-h-[560px] md:min-h-[620px] lg:min-h-[650px]">
      {slides.map((slide, idx) => (
        <div
          key={slide._id || idx}
          className={`absolute inset-0 cursor-pointer transition-opacity duration-700 ${idx === current ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
          role="link"
          tabIndex={idx === current ? 0 : -1}
          onClick={(event) => openBanner(slide, event)}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onKeyDown={(event) => { if (event.key === 'Enter') openBanner(slide, event); }}
        >
          {(slide.mobileImage || slide.tabletImage || slide.desktopImage || slide.image) ? (
            <picture className="block h-full w-full">
              <source media="(max-width: 639px)" srcSet={slide.mobileImage || slide.tabletImage || slide.desktopImage || slide.image} />
              <source media="(max-width: 1023px)" srcSet={slide.tabletImage || slide.desktopImage || slide.image || slide.mobileImage} />
              <img src={slide.desktopImage || slide.image || slide.tabletImage || slide.mobileImage} alt={slide.title || ''} className="h-full w-full bg-white object-contain" />
            </picture>
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-primary-800 via-primary-600 to-accent-500" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/38 via-black/18 to-black/10 sm:bg-gradient-to-r sm:from-black/46 sm:via-black/20 sm:to-black/5" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-black/5" />
          <div className="relative z-10 mx-auto flex min-h-[520px] max-w-7xl items-center px-4 pb-28 pt-12 sm:min-h-[560px] sm:pt-20 md:min-h-[640px] md:px-6 lg:min-h-[690px]">
            <div key={key} className={`max-w-3xl ${idx === current ? 'hero-text-in' : ''}`}>
              {settings?.heroEyebrow && (
                <p className="mb-4 inline-flex rounded-full border border-white/20 bg-white/12 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-accent-200 backdrop-blur-sm">
                  {settings.heroEyebrow}
                </p>
              )}
              {(slide.title || fallbackTitle) && (
                <h1 className="text-3xl font-display font-extrabold leading-tight text-white drop-shadow-2xl sm:text-4xl md:text-6xl lg:text-7xl">
                  {slide.title || fallbackTitle}
                </h1>
              )}
              {(slide.subtitle || fallbackSubtitle) && (
                <p className="mt-4 max-w-2xl text-sm leading-7 text-white/88 drop-shadow sm:text-base md:text-xl md:leading-8">
                  {slide.subtitle || fallbackSubtitle}
                </p>
              )}
              <div className="mt-7 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                {(slide.buttonText || fallbackButtonText) && (
                  <Link
                    href={slide.link || '/shop'}
                    onClick={() => trackBannerClick(slide)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-accent-500 px-5 py-3.5 text-sm font-extrabold text-white shadow-orange transition-all duration-200 hover:-translate-y-1 hover:bg-accent-600 sm:w-auto sm:px-8 sm:py-4 sm:text-base md:px-10"
                  >
                    <FiShoppingBag size={18} />
                    {slide.buttonText || fallbackButtonText}
                  </Link>
                )}
                <Link
                  href="/shop"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/35 bg-white/12 px-5 py-3.5 text-sm font-bold text-white backdrop-blur-sm transition-all duration-200 hover:bg-white hover:text-primary-700 sm:w-auto sm:px-6 sm:py-4 sm:text-base"
                >
                  Explore gifts
                </Link>
              </div>
            </div>
          </div>
        </div>
      ))}

      {slides.length > 1 && (
        <>
          <button
            onClick={() => goTo((current - 1 + slides.length) % slides.length)}
            className="absolute left-2 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-white/15 text-white shadow-lg backdrop-blur-sm transition-all duration-200 hover:bg-white hover:text-gray-900 sm:flex md:left-6 md:h-11 md:w-11"
            aria-label="Previous banner"
          >
            <FiChevronLeft size={22} />
          </button>
          <button
            onClick={() => goTo((current + 1) % slides.length)}
            className="absolute right-2 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-white/15 text-white shadow-lg backdrop-blur-sm transition-all duration-200 hover:bg-white hover:text-gray-900 sm:flex md:right-6 md:h-11 md:w-11"
            aria-label="Next banner"
          >
            <FiChevronRight size={22} />
          </button>
          <div className="absolute bottom-24 left-1/2 z-20 flex -translate-x-1/2 gap-2 sm:bottom-24">
            {slides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => goTo(idx)}
                aria-label={`Show banner ${idx + 1}`}
                className={`h-2 rounded-full transition-all duration-300 ${idx === current ? 'w-9 bg-accent-400' : 'w-2 bg-white/65 hover:bg-white'}`}
              />
            ))}
          </div>
        </>
      )}

      {trustBadges.length > 0 && (
        <div className="absolute bottom-0 left-0 right-0 z-20 border-t border-white/15 bg-white/10 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center justify-center gap-3 px-4 py-4 md:gap-5">
            {trustBadges.slice(0, 4).map((badge, idx) => {
              const Icon = TRUST_ICONS[idx % TRUST_ICONS.length];
              return (
                <div key={badge} className={`${idx > 1 ? 'hidden md:flex' : 'flex'} min-w-0 items-center gap-2 rounded-xl border border-white/15 bg-white/12 px-3 py-2 text-xs font-bold text-white shadow-sm md:text-sm`}>
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-accent-500 text-white">
                    <Icon size={15} />
                  </span>
                  <span className="truncate">{badge}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
