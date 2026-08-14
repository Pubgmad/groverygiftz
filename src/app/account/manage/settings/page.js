'use client';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import PasswordInput from '@/components/common/PasswordInput';
import ImageUploader from '@/components/admin/ImageUploader';
import AdminHomeGiftSettings from '@/components/admin/AdminHomeGiftSettings';
import { resolveGiftFinderForUi, defaultTickerMessages, defaultHotspotSpots } from '@/lib/giftFinderResolve';

export default function AdminSettingsPage() {
  const [form, setForm] = useState({
    siteName: '', tagline: '', logo: '', desktopLogo: '', tabletLogo: '', mobileLogo: '', favicon: '', announcementText: '',
    phone: '', email: '', whatsapp: '', address: '', timings: '',
    socialLinks: { instagram: '', youtube: '' },
    freeShippingThreshold: 499, shippingCost: 40, tamilNaduShippingCost: 0, otherStateShippingCost: 120, tamilNaduDeliveryEstimate: 'Within 8 days', otherStateDeliveryEstimate: '10-15 days',
    promoEnabled: true, promoTitle: '', promoSubtitle: '', promoEndsAt: '', promoButtonText: '', promoButtonLink: '',
    gstNumber: '33KVUPS5560J1ZL', tradeName: 'GroveryGiftz',
    spotlightProductSlug: '',
    promoBannerImage: '', promoBannerDesktopImage: '', promoBannerTabletImage: '', promoBannerMobileImage: '', promoBannerTitle: '', promoBannerSubtitle: '', promoBannerButtonText: '', promoBannerButtonLink: '',
    cashfreeEnabled: false, cashfreeAppId: '', cashfreeSecretKey: '', cashfreeEnvironment: 'sandbox',
    metaPixelEnabled: false, metaPixelId: '', metaPixelTestEventCode: '',
    googleReviewsEnabled: false, googleReviewsSerpApiKey: '', googleReviewsPlaceId: '', googleReviewsDataId: '', googleReviewsSortBy: 'newestFirst', googleReviewsCacheHours: 12,
    heroEyebrow: '',
    heroTrustBadgesText: '',
    homeCollectionsEyebrow: '',
    homeCollectionsTitle: '',
    homeCollectionsSubtitle: '',
    homeCollectionsButtonText: '',
    homeFeaturedProductsEyebrow: '',
    homeFeaturedProductsTitle: '',
    homeFeaturedProductsSubtitle: '',
    homeFeaturedProductsButtonText: '',
    homeBestSellersEyebrow: '',
    homeBestSellersTitle: '',
    homeBestSellersSubtitle: '',
    homeBestSellersButtonText: '',
    homeOffersEyebrow: '',
    homeOffersTitle: '',
    homeOffersSubtitle: '',
    homeOffersButtonText: '',
    homeAllProductsEyebrow: '',
    homeAllProductsTitle: '',
    homeAllProductsSubtitle: '',
    homeAllProductsButtonText: '',
    collectionShowcaseSlug: '',
    collectionShowcaseTitle: '',
    collectionShowcaseSubtitle: '',
    tickerMessagesText: '',
    beforeAfterTitle: '',
    beforeAfterDescription: '',
    beforeAfterImageBefore: '',
    beforeAfterImageAfter: '',
    hotspotBannerTitle: '',
    hotspotBannerImage: '',
    hotspotSpots: [],
    newsletterBadge: '',
    newsletterTitle: '',
    newsletterSubtitle: '',
    newsletterPlaceholder: '',
    giftFinderStillConfused: '',
    giftFinderTryLine: '',
    giftFinderDescription: '',
    giftFinderOccasions: [],
    giftFinderTypes: [],
    giftFinderQuickPicks: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then((d) => {
      const gf = resolveGiftFinderForUi(d);
      setForm({
        siteName: d.siteName || '', tagline: d.tagline || '', logo: d.logo || '', desktopLogo: d.desktopLogo || d.logo || '', tabletLogo: d.tabletLogo || '', mobileLogo: d.mobileLogo || '', favicon: d.favicon || '',
        announcementText: d.announcementText || '', phone: d.phone || '', email: d.email || '',
        whatsapp: d.whatsapp || '', address: d.address || '', timings: d.timings || '',
        socialLinks: { instagram: d.socialLinks?.instagram || '', youtube: d.socialLinks?.youtube || '' },
        freeShippingThreshold: d.freeShippingThreshold ?? 499, shippingCost: d.shippingCost ?? 40, tamilNaduShippingCost: d.tamilNaduShippingCost ?? 0, otherStateShippingCost: d.otherStateShippingCost ?? 120, tamilNaduDeliveryEstimate: d.tamilNaduDeliveryEstimate || 'Within 8 days', otherStateDeliveryEstimate: d.otherStateDeliveryEstimate || '10-15 days',
        promoEnabled: d.promoEnabled ?? true,
        promoTitle: d.promoTitle || 'Limited Time Offer!',
        promoSubtitle: d.promoSubtitle || "Hurry! Sale ends soon. Don't miss out on amazing deals.",
        promoEndsAt: d.promoEndsAt ? new Date(d.promoEndsAt).toISOString().slice(0, 16) : '',
        promoButtonText: d.promoButtonText || 'Shop Now',
        promoButtonLink: d.promoButtonLink || '/shop',
        gstNumber: d.gstNumber || '33KVUPS5560J1ZL', tradeName: d.tradeName || 'GroveryGiftz',
        spotlightProductSlug: d.spotlightProductSlug || '',
        promoBannerImage: d.promoBannerImage || '',
        promoBannerDesktopImage: d.promoBannerDesktopImage || d.promoBannerImage || '',
        promoBannerTabletImage: d.promoBannerTabletImage || '',
        promoBannerMobileImage: d.promoBannerMobileImage || '',
        promoBannerTitle: d.promoBannerTitle || 'Discover Our Latest Collections',
        promoBannerSubtitle: d.promoBannerSubtitle || 'Unique gifts for every occasion',
        promoBannerButtonText: d.promoBannerButtonText || 'Shop Now',
        promoBannerButtonLink: d.promoBannerButtonLink || '/shop',
        cashfreeEnabled: d.cashfreeEnabled ?? false,
        cashfreeAppId: d.cashfreeAppId || '',
        cashfreeSecretKey: d.cashfreeSecretKey || '',
        cashfreeEnvironment: d.cashfreeEnvironment || 'sandbox',
        metaPixelEnabled: d.metaPixelEnabled ?? false,
        metaPixelId: d.metaPixelId || '',
        metaPixelTestEventCode: d.metaPixelTestEventCode || '',
        googleReviewsEnabled: d.googleReviewsEnabled ?? false,
        googleReviewsSerpApiKey: d.googleReviewsSerpApiKey || '',
        googleReviewsPlaceId: d.googleReviewsPlaceId || '',
        googleReviewsDataId: d.googleReviewsDataId || '',
        googleReviewsSortBy: d.googleReviewsSortBy || 'newestFirst',
        googleReviewsCacheHours: d.googleReviewsCacheHours ?? 12,
        heroEyebrow: d.heroEyebrow || '',
        heroTrustBadgesText: (d.heroTrustBadges && d.heroTrustBadges.length) ? d.heroTrustBadges.join('\n') : '',
        homeCollectionsEyebrow: d.homeCollectionsEyebrow || '',
        homeCollectionsTitle: d.homeCollectionsTitle || '',
        homeCollectionsSubtitle: d.homeCollectionsSubtitle || '',
        homeCollectionsButtonText: d.homeCollectionsButtonText || '',
        homeFeaturedProductsEyebrow: d.homeFeaturedProductsEyebrow || '',
        homeFeaturedProductsTitle: d.homeFeaturedProductsTitle || 'Make their day extra extra special',
        homeFeaturedProductsSubtitle: d.homeFeaturedProductsSubtitle || '',
        homeFeaturedProductsButtonText: d.homeFeaturedProductsButtonText || '',
        homeBestSellersEyebrow: d.homeBestSellersEyebrow || 'Best sellers',
        homeBestSellersTitle: d.homeBestSellersTitle || 'Customer Favourite Gifts',
        homeBestSellersSubtitle: d.homeBestSellersSubtitle || '',
        homeBestSellersButtonText: d.homeBestSellersButtonText || 'View Best Sellers',
        homeOffersEyebrow: d.homeOffersEyebrow || 'Limited offers',
        homeOffersTitle: d.homeOffersTitle || 'Limited Time Offers',
        homeOffersSubtitle: d.homeOffersSubtitle || '',
        homeOffersButtonText: d.homeOffersButtonText || 'View Offers',
        homeAllProductsEyebrow: d.homeAllProductsEyebrow || d.homeFeaturedProductsEyebrow || '',
        homeAllProductsTitle: d.homeAllProductsTitle || d.homeFeaturedProductsTitle || 'All Products',
        homeAllProductsSubtitle: d.homeAllProductsSubtitle || d.homeFeaturedProductsSubtitle || '',
        homeAllProductsButtonText: d.homeAllProductsButtonText || d.homeFeaturedProductsButtonText || 'Explore Products',
        collectionShowcaseSlug: d.collectionShowcaseSlug || '',
        collectionShowcaseTitle: d.collectionShowcaseTitle || '',
        collectionShowcaseSubtitle: d.collectionShowcaseSubtitle || 'Perfect gifts for your loved ones.',
        tickerMessagesText: (d.tickerMessages && d.tickerMessages.length)
          ? d.tickerMessages.join('\n')
          : defaultTickerMessages().join('\n'),
        beforeAfterTitle: d.beforeAfterTitle || 'Fire Photo Frame',
        beforeAfterDescription: d.beforeAfterDescription || 'Ignite the frame, unveil the memory!',
        beforeAfterImageBefore: d.beforeAfterImageBefore || '',
        beforeAfterImageAfter: d.beforeAfterImageAfter || '',
        hotspotBannerTitle: d.hotspotBannerTitle || 'Hotspot Banner',
        hotspotBannerImage: d.hotspotBannerImage || '',
        hotspotSpots: d.hotspotSpots?.length ? d.hotspotSpots : defaultHotspotSpots(),
        newsletterBadge: d.newsletterBadge || 'Newsletter',
        newsletterTitle: d.newsletterTitle || 'Get Exclusive Deals & Gift Ideas',
        newsletterSubtitle: d.newsletterSubtitle || 'Join our newsletter for new arrivals, special offers and gifting inspiration.',
        newsletterPlaceholder: d.newsletterPlaceholder || 'Your email address',
        giftFinderStillConfused: d.giftFinderStillConfused ?? '',
        giftFinderTryLine: d.giftFinderTryLine ?? '',
        giftFinderDescription: d.giftFinderDescription ?? '',
        giftFinderOccasions: d.giftFinderOccasions?.length ? d.giftFinderOccasions : gf.occasions,
        giftFinderTypes: d.giftFinderTypes?.length ? d.giftFinderTypes : gf.types,
        giftFinderQuickPicks: d.giftFinderQuickPicks?.length ? d.giftFinderQuickPicks : gf.quickPicks,
      });
      setLoading(false);
    });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const { tickerMessagesText, heroTrustBadgesText, ...rest } = form;
    const payload = {
      ...rest,
      freeShippingThreshold: Number(rest.freeShippingThreshold) || 499,
      shippingCost: Number(rest.shippingCost) || 40,
      tamilNaduShippingCost: Number(rest.tamilNaduShippingCost) || 0,
      otherStateShippingCost: Number(rest.otherStateShippingCost) || 0,
      tamilNaduDeliveryEstimate: rest.tamilNaduDeliveryEstimate || 'Within 8 days',
      otherStateDeliveryEstimate: rest.otherStateDeliveryEstimate || '10-15 days',
      tickerMessages: tickerMessagesText.split('\n').map((s) => s.trim()).filter(Boolean),
      heroTrustBadges: heroTrustBadgesText.split('\n').map((s) => s.trim()).filter(Boolean),
      giftFinderOccasions: (rest.giftFinderOccasions || []).filter((r) => r.value?.trim() && r.label?.trim()),
      giftFinderTypes: (rest.giftFinderTypes || []).filter((r) => r.value?.trim() && r.label?.trim()),
      giftFinderQuickPicks: (rest.giftFinderQuickPicks || []).filter((r) => r.label?.trim()),
      hotspotSpots: (rest.hotspotSpots || []).filter((s) => s.label?.trim()),
    };
    const res = await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    setSaving(false);
    if (res.ok) toast.success('Settings saved!');
    else toast.error('Failed to save');
  };

  if (loading) return <div className="text-center py-12">Loading...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Site Settings</h1>
      <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
        <div className="bg-white p-6 rounded-xl border space-y-4">
          <h2 className="font-bold text-lg">General</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium mb-1">Site Name</label><input value={form.siteName} onChange={e => setForm(p => ({ ...p, siteName: e.target.value }))} className="w-full border rounded-lg px-4 py-2" /></div>
            <div><label className="block text-sm font-medium mb-1">Tagline</label><input value={form.tagline} onChange={e => setForm(p => ({ ...p, tagline: e.target.value }))} className="w-full border rounded-lg px-4 py-2" /></div>
          </div>
          <div className="space-y-3">
            <label className="block text-sm font-medium">Website Logo Assets</label>
            <p className="text-xs text-gray-500">Use the remove button on a saved logo to delete it permanently. Desktop is used as the fallback when tablet or mobile logos are empty. Favicon is used for the browser tab icon.</p>
            <div className="grid gap-4 lg:grid-cols-4">
              <div className="rounded-xl border border-primary-100 bg-primary-50/40 p-3"><p className="mb-1 text-sm font-semibold">Desktop Logo</p><p className="mb-2 text-xs text-gray-500">Recommended: 420 x 120 px transparent PNG/WebP</p><ImageUploader replaceOnUpload deleteOnRemove confirmRemove images={(form.desktopLogo || form.logo) ? [form.desktopLogo || form.logo] : []} onChange={imgs => setForm(p => ({ ...p, desktopLogo: imgs[0] || '', logo: imgs[0] || '' }))} /></div>
              <div className="rounded-xl border border-primary-100 bg-primary-50/40 p-3"><p className="mb-1 text-sm font-semibold">Tablet Logo</p><p className="mb-2 text-xs text-gray-500">Recommended: 360 x 110 px</p><ImageUploader replaceOnUpload deleteOnRemove confirmRemove images={form.tabletLogo ? [form.tabletLogo] : []} onChange={imgs => setForm(p => ({ ...p, tabletLogo: imgs[0] || '' }))} /></div>
              <div className="rounded-xl border border-primary-100 bg-primary-50/40 p-3"><p className="mb-1 text-sm font-semibold">Mobile Logo</p><p className="mb-2 text-xs text-gray-500">Recommended: 300 x 90 px</p><ImageUploader replaceOnUpload deleteOnRemove confirmRemove images={form.mobileLogo ? [form.mobileLogo] : []} onChange={imgs => setForm(p => ({ ...p, mobileLogo: imgs[0] || '' }))} /></div>
              <div className="rounded-xl border border-primary-100 bg-primary-50/40 p-3"><p className="mb-1 text-sm font-semibold">Favicon / Browser Tab Icon</p><p className="mb-2 text-xs text-gray-500">Recommended: square 512 x 512 PNG/WebP</p><ImageUploader replaceOnUpload deleteOnRemove confirmRemove images={form.favicon ? [form.favicon] : []} onChange={imgs => setForm(p => ({ ...p, favicon: imgs[0] || '' }))} /></div>
            </div>
          </div>
          <div><label className="block text-sm font-medium mb-1">Announcement Bar Text</label><input value={form.announcementText} onChange={e => setForm(p => ({ ...p, announcementText: e.target.value }))} className="w-full border rounded-lg px-4 py-2" /></div>
        </div>

        <div className="bg-white p-6 rounded-xl border space-y-4">
          <h2 className="font-bold text-lg">Contact</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium mb-1">Phone</label><input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} className="w-full border rounded-lg px-4 py-2" /></div>
            <div><label className="block text-sm font-medium mb-1">Email</label><input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className="w-full border rounded-lg px-4 py-2" /></div>
            <div><label className="block text-sm font-medium mb-1">WhatsApp</label><input value={form.whatsapp} onChange={e => setForm(p => ({ ...p, whatsapp: e.target.value }))} className="w-full border rounded-lg px-4 py-2" /></div>
            <div><label className="block text-sm font-medium mb-1">Timings</label><input value={form.timings} onChange={e => setForm(p => ({ ...p, timings: e.target.value }))} className="w-full border rounded-lg px-4 py-2" /></div>
          </div>
          <div><label className="block text-sm font-medium mb-1">Address</label><textarea value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} className="w-full border rounded-lg px-4 py-2" rows={2} /></div>
        </div>

        <div className="bg-white p-6 rounded-xl border space-y-4">
          <h2 className="font-bold text-lg">Social Links</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {Object.keys(form.socialLinks).map(key => (
              <div key={key}><label className="block text-sm font-medium mb-1 capitalize">{key}</label>
                <input value={form.socialLinks[key]} onChange={e => setForm(p => ({ ...p, socialLinks: { ...p.socialLinks, [key]: e.target.value } }))} className="w-full border rounded-lg px-4 py-2" placeholder={`https://${key}.com/...`} />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border space-y-4">
          <h2 className="font-bold text-lg">Shipping & Delivery</h2>
          <p className="text-sm text-gray-500">Tamil Nadu delivery can stay free. For other states, set the delivery charge and estimated timeline customers should see during checkout.</p>
          <div className="grid md:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium mb-1">Tamil Nadu Delivery Charge (INR)</label><input type="number" value={form.tamilNaduShippingCost} onChange={e => setForm(p => ({ ...p, tamilNaduShippingCost: e.target.value }))} className="w-full border rounded-lg px-4 py-2" /></div>
            <div><label className="block text-sm font-medium mb-1">Other States Delivery Charge (INR)</label><input type="number" value={form.otherStateShippingCost} onChange={e => setForm(p => ({ ...p, otherStateShippingCost: e.target.value }))} className="w-full border rounded-lg px-4 py-2" /></div>
            <div><label className="block text-sm font-medium mb-1">Tamil Nadu Delivery Estimate</label><input value={form.tamilNaduDeliveryEstimate} onChange={e => setForm(p => ({ ...p, tamilNaduDeliveryEstimate: e.target.value }))} className="w-full border rounded-lg px-4 py-2" placeholder="Within 8 days" /></div>
            <div><label className="block text-sm font-medium mb-1">Other States Delivery Estimate</label><input value={form.otherStateDeliveryEstimate} onChange={e => setForm(p => ({ ...p, otherStateDeliveryEstimate: e.target.value }))} className="w-full border rounded-lg px-4 py-2" placeholder="10-15 days" /></div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border space-y-4">
          <h2 className="font-bold text-lg">Promo Countdown Banner</h2>
          <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
            <input type="checkbox" checked={form.promoEnabled} onChange={e => setForm(p => ({ ...p, promoEnabled: e.target.checked }))} />
            Enable Countdown Banner
          </label>
          <div className="grid md:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium mb-1">Banner Title</label><input value={form.promoTitle} onChange={e => setForm(p => ({ ...p, promoTitle: e.target.value }))} className="w-full border rounded-lg px-4 py-2" /></div>
            <div><label className="block text-sm font-medium mb-1">Ends At</label><input type="datetime-local" value={form.promoEndsAt} onChange={e => setForm(p => ({ ...p, promoEndsAt: e.target.value }))} className="w-full border rounded-lg px-4 py-2" /></div>
            <div><label className="block text-sm font-medium mb-1">Button Text</label><input value={form.promoButtonText} onChange={e => setForm(p => ({ ...p, promoButtonText: e.target.value }))} className="w-full border rounded-lg px-4 py-2" /></div>
            <div><label className="block text-sm font-medium mb-1">Button Link</label><input value={form.promoButtonLink} onChange={e => setForm(p => ({ ...p, promoButtonLink: e.target.value }))} className="w-full border rounded-lg px-4 py-2" placeholder="/shop" /></div>
          </div>
          <div><label className="block text-sm font-medium mb-1">Banner Subtitle</label><input value={form.promoSubtitle} onChange={e => setForm(p => ({ ...p, promoSubtitle: e.target.value }))} className="w-full border rounded-lg px-4 py-2" /></div>
        </div>

        <div className="bg-white p-6 rounded-xl border space-y-4">
          <h2 className="font-bold text-lg">Business Info</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <div><label className="block text-sm font-medium mb-1">GST Number</label><input value={form.gstNumber} onChange={e => setForm(p => ({ ...p, gstNumber: e.target.value }))} className="w-full border rounded-lg px-4 py-2" /></div>
            <div><label className="block text-sm font-medium mb-1">Trade Name</label><input value={form.tradeName} onChange={e => setForm(p => ({ ...p, tradeName: e.target.value }))} className="w-full border rounded-lg px-4 py-2" /></div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border space-y-4">
          <h2 className="font-bold text-lg">Cashfree Payment Gateway</h2>
          <p className="text-sm text-gray-500">Configure Cashfree to accept secure online payments through UPI, cards, wallets and net banking. Offline payment is disabled for this store.</p>
          <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
            <input type="checkbox" checked={form.cashfreeEnabled} onChange={e => setForm(p => ({ ...p, cashfreeEnabled: e.target.checked }))} />
            Enable Cashfree Online Payments
          </label>
          <div className="grid md:grid-cols-3 gap-4">
            <div><label className="block text-sm font-medium mb-1">Environment</label><select value={form.cashfreeEnvironment} onChange={e => setForm(p => ({ ...p, cashfreeEnvironment: e.target.value }))} className="w-full border rounded-lg px-4 py-2"><option value="sandbox">Sandbox</option><option value="production">Production</option></select></div>
            <div><label className="block text-sm font-medium mb-1">App ID</label><input value={form.cashfreeAppId} onChange={e => setForm(p => ({ ...p, cashfreeAppId: e.target.value }))} className="w-full border rounded-lg px-4 py-2 font-mono text-sm" placeholder="Cashfree App ID" /></div>
            <div><label className="block text-sm font-medium mb-1">Secret Key <span className="text-red-400">(keep secret!)</span></label><PasswordInput value={form.cashfreeSecretKey} onChange={e => setForm(p => ({ ...p, cashfreeSecretKey: e.target.value }))} inputClassName="w-full border rounded-lg px-4 py-2 font-mono text-sm focus:outline-none focus:border-primary-500" placeholder="Cashfree Secret Key" /></div>
          </div>
          {form.cashfreeEnabled && (!form.cashfreeAppId || !form.cashfreeSecretKey) && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">Cashfree is enabled but keys are not set. Customers will see secure online payment, but payment cannot start until you add the keys.</p>
          )}
        </div>
        <div className="bg-white p-6 rounded-xl border space-y-4">
          <h2 className="font-bold text-lg">Marketing Tracking</h2>
          <p className="text-sm text-gray-500">Add your Meta Pixel ID here. Tracking runs only on customer-facing pages and is skipped on admin pages.</p>
          <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
            <input type="checkbox" checked={form.metaPixelEnabled} onChange={e => setForm(p => ({ ...p, metaPixelEnabled: e.target.checked }))} />
            Enable Meta Pixel
          </label>
          <div className="grid md:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium mb-1">Meta Pixel ID</label><input value={form.metaPixelId} onChange={e => setForm(p => ({ ...p, metaPixelId: e.target.value.replace(/\D/g, '') }))} className="w-full border rounded-lg px-4 py-2 font-mono text-sm" placeholder="Paste only the number from fbq('init', '...')" /></div>
            <div><label className="block text-sm font-medium mb-1">Test Event Code <span className="text-gray-400">(optional)</span></label><input value={form.metaPixelTestEventCode} onChange={e => setForm(p => ({ ...p, metaPixelTestEventCode: e.target.value }))} className="w-full border rounded-lg px-4 py-2 font-mono text-sm" placeholder="TEST12345" /></div>
          </div>
          {form.metaPixelEnabled && !form.metaPixelId && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">Meta Pixel is enabled but Pixel ID is empty. Paste your Pixel ID before testing.</p>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 mb-6 space-y-4">
          <h2 className="font-bold text-lg">Google Reviews via SerpApi</h2>
          <p className="text-sm text-gray-500">Fetch real Google Maps reviews through SerpApi. The API key is stored server-side and never sent to customers.</p>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={form.googleReviewsEnabled} onChange={e => setForm(p => ({ ...p, googleReviewsEnabled: e.target.checked }))} />
            Enable Google Reviews
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <div><label className="block text-sm font-medium mb-1">SerpApi Key <span className="text-red-400">(keep secret!)</span></label><PasswordInput value={form.googleReviewsSerpApiKey} onChange={e => setForm(p => ({ ...p, googleReviewsSerpApiKey: e.target.value }))} inputClassName="w-full border rounded-lg px-4 py-2 font-mono text-sm focus:outline-none focus:border-primary-500" placeholder="SerpApi private key" /></div>
            <div><label className="block text-sm font-medium mb-1">Google Place ID</label><input value={form.googleReviewsPlaceId} onChange={e => setForm(p => ({ ...p, googleReviewsPlaceId: e.target.value }))} className="w-full border rounded-lg px-4 py-2 font-mono text-sm" placeholder="ChIJ..." /></div>
            <div><label className="block text-sm font-medium mb-1">Google Maps Data ID <span className="text-gray-400">(optional)</span></label><input value={form.googleReviewsDataId} onChange={e => setForm(p => ({ ...p, googleReviewsDataId: e.target.value }))} className="w-full border rounded-lg px-4 py-2 font-mono text-sm" placeholder="0x...:0x..." /></div>
            <div><label className="block text-sm font-medium mb-1">Sort Reviews</label><select value={form.googleReviewsSortBy} onChange={e => setForm(p => ({ ...p, googleReviewsSortBy: e.target.value }))} className="w-full border rounded-lg px-4 py-2"><option value="newestFirst">Newest first</option><option value="qualityScore">Most relevant</option><option value="ratingHigh">Highest rating</option><option value="ratingLow">Poorest / lowest rating</option></select></div>
            <div><label className="block text-sm font-medium mb-1">Refresh Cache Every Hours</label><input type="number" min="1" value={form.googleReviewsCacheHours} onChange={e => setForm(p => ({ ...p, googleReviewsCacheHours: e.target.value }))} className="w-full border rounded-lg px-4 py-2" /></div>
          </div>
          {form.googleReviewsEnabled && !form.googleReviewsPlaceId && !form.googleReviewsDataId && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">Add either Google Place ID or Data ID for SerpApi reviews to work.</p>
          )}
        </div>

        <div className="bg-white p-6 rounded-xl border space-y-4">
          <h2 className="font-bold text-lg">Product Spotlight</h2>
          <p className="text-sm text-gray-500">Enter the slug of the product to feature in the spotlight section on the homepage.</p>
          <div><label className="block text-sm font-medium mb-1">Product Slug</label><input value={form.spotlightProductSlug} onChange={e => setForm(p => ({ ...p, spotlightProductSlug: e.target.value }))} className="w-full border rounded-lg px-4 py-2" placeholder="e.g. rose-bouquet" /></div>
        </div>

        <div className="bg-white p-6 rounded-xl border space-y-4">
          <h2 className="font-bold text-lg">Promo Image Banner</h2>
          <p className="text-sm text-gray-500">Full-width banner shown between sections on the homepage. If no image is set, a gradient is shown.</p>
          <div className="rounded-xl border border-primary-100 bg-primary-50/40 p-3"><label className="mb-1 block text-sm font-semibold">Landscape Promo Banner</label><p className="mb-2 text-xs text-gray-500">Upload one landscape banner. The website preserves the full image ratio across mobile, tablet, and desktop.</p><ImageUploader replaceOnUpload images={(form.promoBannerDesktopImage || form.promoBannerImage || form.promoBannerTabletImage || form.promoBannerMobileImage) ? [form.promoBannerDesktopImage || form.promoBannerImage || form.promoBannerTabletImage || form.promoBannerMobileImage] : []} onChange={imgs => setForm(p => ({ ...p, promoBannerDesktopImage: imgs[0] || '', promoBannerImage: imgs[0] || '', promoBannerTabletImage: imgs[0] || '', promoBannerMobileImage: imgs[0] || '' }))} /></div>
          <div className="grid md:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium mb-1">Title</label><input value={form.promoBannerTitle} onChange={e => setForm(p => ({ ...p, promoBannerTitle: e.target.value }))} className="w-full border rounded-lg px-4 py-2" /></div>
            <div><label className="block text-sm font-medium mb-1">Subtitle</label><input value={form.promoBannerSubtitle} onChange={e => setForm(p => ({ ...p, promoBannerSubtitle: e.target.value }))} className="w-full border rounded-lg px-4 py-2" /></div>
            <div><label className="block text-sm font-medium mb-1">Button Text</label><input value={form.promoBannerButtonText} onChange={e => setForm(p => ({ ...p, promoBannerButtonText: e.target.value }))} className="w-full border rounded-lg px-4 py-2" /></div>
            <div><label className="block text-sm font-medium mb-1">Button Link</label><input value={form.promoBannerButtonLink} onChange={e => setForm(p => ({ ...p, promoBannerButtonLink: e.target.value }))} className="w-full border rounded-lg px-4 py-2" placeholder="/shop" /></div>
          </div>
        </div>

        <AdminHomeGiftSettings form={form} setForm={setForm} />

        <button type="submit" disabled={saving} className="w-full sm:w-auto bg-primary-600 text-white px-6 sm:px-8 py-3 rounded-lg font-semibold hover:bg-primary-700">
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </form>
    </div>
  );
}


