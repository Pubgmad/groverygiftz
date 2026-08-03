import mongoose from 'mongoose';

const GiftFinderOptionSchema = new mongoose.Schema({
  value: { type: String, default: '' },
  label: { type: String, default: '' },
  keywords: { type: String, default: '' },
}, { _id: false });

const GiftFinderQuickPickSchema = new mongoose.Schema({
  label: { type: String, default: '' },
  occasion: { type: String, default: '' },
  giftType: { type: String, default: '' },
}, { _id: false });

const HotspotSpotSchema = new mongoose.Schema({
  label: { type: String, default: '' },
  href: { type: String, default: '/shop' },
  top: { type: String, default: '40%' },
  left: { type: String, default: '50%' },
}, { _id: false });

const SettingsSchema = new mongoose.Schema({
  siteName: { type: String, default: 'GroveryGiftz' },
  tagline: { type: String, default: 'Perfect Gifts for Your Loved Ones' },
  logo: String,
  announcementText: { type: String, default: 'Free shipping on orders above INR 499' },
  phone: { type: String, default: '+91 99945 49781' },
  email: { type: String, default: 'Groverygiftz@gmail.com' },
  whatsapp: { type: String, default: '919994549781' },
  address: { type: String, default: '126, 3rd St, V.C.K.N.Layout, Sivananda Colony, Tatabad, Coimbatore, Tamil Nadu 641012' },
  timings: { type: String, default: '11 am to 7 pm' },
  socialLinks: {
    instagram: { type: String, default: 'https://www.instagram.com/groverygiftz?igsh=dGNpbHlybWI0cjNy' },
    youtube: { type: String, default: '' },
  },
  freeShippingThreshold: { type: Number, default: 499 },
  shippingCost: { type: Number, default: 40 },
  tamilNaduShippingCost: { type: Number, default: 0 },
  otherStateShippingCost: { type: Number, default: 120 },
  tamilNaduDeliveryEstimate: { type: String, default: 'Within 8 days' },
  otherStateDeliveryEstimate: { type: String, default: '10-15 days' },
  promoEnabled: { type: Boolean, default: true },
  promoTitle: { type: String, default: 'Limited Time Offer!' },
  promoSubtitle: { type: String, default: "Hurry! Sale ends soon. Don't miss out on amazing deals." },
  promoEndsAt: Date,
  promoButtonText: { type: String, default: 'Shop Now' },
  promoButtonLink: { type: String, default: '/shop' },
  gstNumber: { type: String, default: '33KVUPS5560J1ZL' },
  tradeName: String,
  legalName: String,
  spotlightProductSlug: { type: String, default: '' },
  promoBannerImage: { type: String, default: '' },
  promoBannerTitle: { type: String, default: 'Discover Our Latest Collections' },
  promoBannerSubtitle: { type: String, default: 'Unique gifts for every occasion' },
  promoBannerButtonText: { type: String, default: 'Shop Now' },
  promoBannerButtonLink: { type: String, default: '/shop' },
  cashfreeEnabled: { type: Boolean, default: false },
  cashfreeAppId: { type: String, default: '' },
  cashfreeSecretKey: { type: String, default: '' },
  cashfreeEnvironment: { type: String, enum: ['sandbox', 'production'], default: 'sandbox' },

  heroEyebrow: { type: String, default: '' },
  heroTrustBadges: [{ type: String }],
  homeCollectionsEyebrow: { type: String, default: '' },
  homeCollectionsTitle: { type: String, default: '' },
  homeCollectionsSubtitle: { type: String, default: '' },
  homeCollectionsButtonText: { type: String, default: '' },
  homeFeaturedProductsEyebrow: { type: String, default: '' },
  homeFeaturedProductsTitle: { type: String, default: 'Make their day extra extra special' },
  homeFeaturedProductsSubtitle: { type: String, default: '' },
  homeFeaturedProductsButtonText: { type: String, default: '' },
  collectionShowcaseSlug: { type: String, default: '' },
  collectionShowcaseSubtitle: { type: String, default: 'Perfect gifts for your loved ones.' },
  collectionShowcaseTitle: { type: String, default: '' },
  tickerMessages: [{ type: String }],
  beforeAfterTitle: { type: String, default: 'Fire Photo Frame' },
  beforeAfterDescription: { type: String, default: 'Ignite the frame, unveil the memory!' },
  beforeAfterImageBefore: { type: String, default: '' },
  beforeAfterImageAfter: { type: String, default: '' },
  hotspotBannerTitle: { type: String, default: '' },
  hotspotBannerImage: { type: String, default: '' },
  hotspotSpots: [HotspotSpotSchema],
  newsletterBadge: { type: String, default: 'Newsletter' },
  newsletterTitle: { type: String, default: 'Get Exclusive Deals & Gift Ideas' },
  newsletterSubtitle: { type: String, default: 'Join our newsletter for new arrivals, special offers and gifting inspiration.' },
  newsletterPlaceholder: { type: String, default: 'Your email address' },

  giftFinderStillConfused: { type: String, default: '' },
  giftFinderTryLine: { type: String, default: '' },
  giftFinderDescription: { type: String, default: '' },
  giftFinderOccasions: [GiftFinderOptionSchema],
  giftFinderTypes: [GiftFinderOptionSchema],
  giftFinderQuickPicks: [GiftFinderQuickPickSchema],

  courierTrackingUrlTemplate: { type: String, default: '' },
}, { timestamps: true });

export default mongoose.models.Settings || mongoose.model('Settings', SettingsSchema);

