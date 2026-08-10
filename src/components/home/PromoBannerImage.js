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
    <section className="relative overflow-hidden min-h-[320px] md:min-h-[420px] flex items-center">
      {/* Background: image or gradient */}
      {image ? (
        <picture className="absolute inset-0 block h-full w-full">
          <source media="(max-width: 639px)" srcSet={mobileImage} />
          <source media="(max-width: 1023px)" srcSet={tabletImage} />
          <img
            src={image}
            alt={title}
            className="absolute inset-0 h-full w-full bg-white object-contain"
          />
        </picture>
      ) : (
        <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, #F47920 0%, #F27A1A 55%, #D96212 100%)' }} />
      )}

      {/* Overlay for image readability */}
      {image && (
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/35 to-transparent" />
      )}

      {/* Decorative blobs (no-image only) */}
      {!image && (
        <>
          <div className="absolute -top-20 -right-20 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -left-12 w-64 h-64 bg-white/10 rounded-full blur-2xl" />
        </>
      )}

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-16 md:py-20">
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
    </section>
  );
}
