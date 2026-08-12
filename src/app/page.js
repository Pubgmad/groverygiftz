import HeroCarousel from '@/components/home/HeroCarousel';
import CollectionsGrid from '@/components/home/CollectionsGrid';
import FeaturedProducts from '@/components/home/FeaturedProducts';
import CollectionShowcase from '@/components/home/CollectionShowcase';
import ScrollingTicker from '@/components/home/ScrollingTicker';
import GiftFinder from '@/components/home/GiftFinder';
import PromoBanner from '@/components/home/PromoBanner';
import BeforeAfterSlider from '@/components/home/BeforeAfterSlider';
import HotspotBanner from '@/components/home/HotspotBanner';
import ProductSpotlight from '@/components/home/ProductSpotlight';
import PromoBannerImage from '@/components/home/PromoBannerImage';
import dbConnect from '@/lib/db';
import Product from '@/models/Product';
import Collection from '@/models/Collection';
import Banner from '@/models/Banner';
import Settings from '@/models/Settings';
import { resolveGiftFinderForUi, resolveTickerMessages } from '@/lib/giftFinderResolve';

function activeOfferQuery(now) {
  return {
    isActive: true,
    salePrice: { $gt: 0 },
    $and: [
      { $or: [{ offerStartsAt: { $exists: false } }, { offerStartsAt: null }, { offerStartsAt: { $lte: now } }] },
      { $or: [{ offerEndsAt: { $exists: false } }, { offerEndsAt: null }, { offerEndsAt: { $gte: now } }] },
    ],
    $expr: { $lt: ['$salePrice', '$regularPrice'] },
  };
}

export const dynamic = 'force-dynamic';

async function getData() {
  await dbConnect();

  const settings = await Settings.findOne().lean();
  const s = settings ? JSON.parse(JSON.stringify(settings)) : null;
  const showcaseSlug = s?.collectionShowcaseSlug?.trim();
  const showcaseCollection = showcaseSlug
    ? await Collection.findOne({ slug: showcaseSlug, isActive: true }).lean()
    : null;

  const now = new Date();
  const latestSince = new Date(now);
  latestSince.setMonth(latestSince.getMonth() - 3);
  const [banners, collections, featured, offerProducts, bestSellers, showcaseProducts] = await Promise.all([
    Banner.find({ isActive: true }).sort({ order: 1 }).lean(),
    Collection.find({ isFeatured: true, isActive: true, createdAt: { $gte: latestSince } }).sort({ createdAt: -1, order: 1 }).limit(4).lean(),
    Product.find({ isFeatured: true, isActive: true }).sort({ createdAt: -1 }).limit(12).lean(),
    Product.find(activeOfferQuery(now)).sort({ createdAt: -1 }).limit(12).lean(),
    Product.find({ isBestSeller: true, isActive: true }).sort({ createdAt: -1 }).limit(12).lean(),
    showcaseCollection
      ? Product.find({ collections: showcaseCollection._id, isActive: true }).sort({ createdAt: -1 }).limit(12).lean()
      : Promise.resolve([]),
  ]);

  let spotlightProduct = null;
  if (s?.spotlightProductSlug) {
    spotlightProduct = await Product.findOne({ slug: s.spotlightProductSlug, isActive: true }).lean();
  }
  if (!spotlightProduct) {
    spotlightProduct = featured?.[0] || null;
  }

  return {
    banners: JSON.parse(JSON.stringify(banners)),
    collections: JSON.parse(JSON.stringify(collections)),
    featured: JSON.parse(JSON.stringify(featured)),
    offerProducts: JSON.parse(JSON.stringify(offerProducts)),
    bestSellers: JSON.parse(JSON.stringify(bestSellers)),
    showcaseProducts: JSON.parse(JSON.stringify(showcaseProducts)),
    showcaseSlug: showcaseCollection?.slug || '',
    settings: s,
    spotlightProduct: spotlightProduct ? JSON.parse(JSON.stringify(spotlightProduct)) : null,
    giftFinder: resolveGiftFinderForUi(s),
    tickerMessages: resolveTickerMessages(s),
    hotspotSpots: s?.hotspotSpots?.length ? s.hotspotSpots : [],
  };
}

export default async function HomePage() {
  const {
    banners,
    collections,
    featured,
    offerProducts,
    bestSellers,
    showcaseProducts,
    showcaseSlug,
    settings,
    spotlightProduct,
    giftFinder,
    tickerMessages,
    hotspotSpots,
  } = await getData();

  return (
    <>
      <HeroCarousel banners={banners} settings={settings} />
      <CollectionsGrid collections={collections} settings={settings} />
      <FeaturedProducts
        products={bestSellers}
        eyebrow={settings?.homeBestSellersEyebrow || 'Best sellers'}
        title={settings?.homeBestSellersTitle || 'Customer Favourite Gifts'}
        subtitle={settings?.homeBestSellersSubtitle || ''}
        buttonText={settings?.homeBestSellersButtonText || 'View Best Sellers'}
        buttonLink="/shop?view=best-sellers"
      />
      <FeaturedProducts
        products={offerProducts}
        eyebrow={settings?.homeOffersEyebrow || 'Limited offers'}
        title={settings?.homeOffersTitle || 'Limited Time Offers'}
        subtitle={settings?.homeOffersSubtitle || ''}
        buttonText={settings?.homeOffersButtonText || 'View Offers'}
        buttonLink="/shop?view=offers"
      />
      <FeaturedProducts
        products={featured}
        eyebrow={settings?.homeAllProductsEyebrow || settings?.homeFeaturedProductsEyebrow || ''}
        title={settings?.homeAllProductsTitle || settings?.homeFeaturedProductsTitle || 'All Products'}
        subtitle={settings?.homeAllProductsSubtitle || settings?.homeFeaturedProductsSubtitle || ''}
        buttonText={settings?.homeAllProductsButtonText || settings?.homeFeaturedProductsButtonText || 'Explore Products'}
        buttonLink="/shop"
      />
      <CollectionShowcase
        products={showcaseProducts}
        title={settings?.collectionShowcaseTitle || ''}
        subtitle={settings?.collectionShowcaseSubtitle || ''}
        collectionSlug={showcaseSlug}
      />
      <ScrollingTicker messages={tickerMessages} />
      <ProductSpotlight product={spotlightProduct} />
      <GiftFinder {...giftFinder} />
      <PromoBanner />
      <PromoBannerImage settings={settings} />
      <BeforeAfterSlider
        beforeImage={settings?.beforeAfterImageBefore}
        afterImage={settings?.beforeAfterImageAfter}
        title={settings?.beforeAfterTitle || ''}
        description={settings?.beforeAfterDescription || ''}
      />
      <HotspotBanner
        title={settings?.hotspotBannerTitle || ''}
        image={settings?.hotspotBannerImage}
        products={hotspotSpots}
      />
    </>
  );
}
