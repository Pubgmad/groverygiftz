'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { trackMetaCustomEvent } from '@/lib/metaPixel';

function bannerImage(slide = {}) {
  return slide.desktopImage || slide.image || slide.tabletImage || slide.mobileImage || '';
}

function tabletBannerImage(slide = {}) {
  return slide.tabletImage || bannerImage(slide);
}

function mobileBannerImage(slide = {}) {
  return slide.mobileImage || tabletBannerImage(slide);
}

export default function HeroCarousel({ banners = [] }) {
  const [current, setCurrent] = useState(0);
  const router = useRouter();
  const slides = banners.filter((banner) => banner?.image || banner?.desktopImage || banner?.tabletImage || banner?.mobileImage);
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

  useEffect(() => {
    if (slides.length <= 1) return undefined;
    const timer = setInterval(() => {
      setCurrent((idx) => (idx + 1) % slides.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [slides.length]);

  if (slides.length === 0) return null;

  const activeSlide = slides[current] || slides[0];
  const activeImage = bannerImage(activeSlide);

  const goTo = (idx) => setCurrent(idx);
  const trackBannerClick = (slide) => {
    trackMetaCustomEvent('BannerClick', {
      banner_title: slide.title || 'Homepage banner',
      banner_link: slide.link || '/shop',
      banner_location: 'hero',
    });
  };

  const openBanner = (slide, event) => {
    if (event?.target?.closest?.('button')) return;
    trackBannerClick(slide);
    router.push(slide.link || '/shop');
  };

  return (
    <section className="relative overflow-hidden bg-white">
      <div
        className="relative cursor-pointer"
        role="link"
        tabIndex={0}
        onClick={(event) => openBanner(activeSlide, event)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onKeyDown={(event) => { if (event.key === 'Enter') openBanner(activeSlide, event); }}
      >
        <picture className="block w-full">
          <source media="(max-width: 639px)" srcSet={mobileBannerImage(activeSlide)} />
          <source media="(max-width: 1023px)" srcSet={tabletBannerImage(activeSlide)} />
          <img src={activeImage} alt={activeSlide.title || 'Homepage banner'} className="block h-auto w-full bg-white object-contain" />
        </picture>
      </div>

      {slides.length > 1 && (
        <>
          <button
            onClick={() => goTo((current - 1 + slides.length) % slides.length)}
            className="absolute left-2 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/20 text-white shadow-lg backdrop-blur-sm transition-all duration-200 hover:bg-white hover:text-gray-900 sm:flex md:left-6 md:h-11 md:w-11"
            aria-label="Previous banner"
          >
            <FiChevronLeft size={22} />
          </button>
          <button
            onClick={() => goTo((current + 1) % slides.length)}
            className="absolute right-2 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/20 text-white shadow-lg backdrop-blur-sm transition-all duration-200 hover:bg-white hover:text-gray-900 sm:flex md:right-6 md:h-11 md:w-11"
            aria-label="Next banner"
          >
            <FiChevronRight size={22} />
          </button>
          <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 gap-2 sm:bottom-5">
            {slides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => goTo(idx)}
                aria-label={`Show banner ${idx + 1}`}
                className={`h-2 rounded-full transition-all duration-300 ${idx === current ? 'w-9 bg-accent-500' : 'w-2 bg-black/30 hover:bg-black/50'}`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

