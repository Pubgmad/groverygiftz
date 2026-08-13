'use client';
import Link from 'next/link';
import { trackMetaCustomEvent } from '@/lib/metaPixel';

export default function PromoBannerImage({ settings }) {
  const title = settings?.promoBannerTitle || 'Discover Our Latest Collections';
  const subtitle = settings?.promoBannerSubtitle || 'Unique gifts for every occasion';
  const btnText = settings?.promoBannerButtonText || 'Shop Now';
  const btnLink = !settings?.promoBannerButtonLink || settings.promoBannerButtonLink === '/shop'
    ? '/shop?view=latest'
    : settings.promoBannerButtonLink;
  const image = settings?.promoBannerDesktopImage || settings?.promoBannerImage;
  const tabletImage = settings?.promoBannerTabletImage || image;
  const mobileImage = settings?.promoBannerMobileImage || tabletImage;

  return (
    <section className={`relative grid overflow-hidden ${image ? 'bg-white' : 'min-h-[320px] md:min-h-[420px]'}`}>
      {image ? (
        <picture className="col-start-1 row-start-1 block w-full">
          <source media="(max-width: 639px)" srcSet={mobileImage} />
          <source media="(max-width: 1023px)" srcSet={tabletImage} />
          <img
            src={image}
            alt={title}
            className="block h-auto w-full bg-white object-contain"
          />
        </picture>
      ) : (
        <div className="col-start-1 row-start-1" style={{ background: 'linear-gradient(90deg, #F47920 0%, #F27A1A 55%, #D96212 100%)' }} />
      )}

      {image && <div className="pointer-events-none col-start-1 row-start-1 bg-gradient-to-r from-black/60 via-black/35 to-transparent" />}

      {!image && (
        <>
          <div className="absolute -top-20 -right-20 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -left-12 w-64 h-64 bg-white/10 rounded-full blur-2xl" />
        </>
      )}

      <div className="relative z-10 col-start-1 row-start-1 flex items-center">
        <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 md:py-16">
          <div className="max-w-xl">
            {subtitle && (
              <span className="inline-block text-white/80 text-sm font-medium tracking-widest uppercase mb-3">
                {subtitle}
              </span>
            )}
            <h2 className="text-2xl sm:text-3xl md:text-5xl font-display font-bold text-white leading-tight mb-6">
              {title}
            </h2>
            <Link
              href={btnLink}
              onClick={() => trackMetaCustomEvent('BannerClick', { banner_title: title, banner_link: btnLink, banner_location: 'promo_image' })}
              className="inline-flex w-full items-center justify-center gap-2 bg-white text-accent-700 font-bold px-5 py-3.5 rounded-full hover:bg-accent-50 hover:text-accent-600 transition-colors shadow-lg text-sm sm:w-auto sm:px-8 sm:text-base"
            >
              {btnText}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

