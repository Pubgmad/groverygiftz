'use client';
import toast from 'react-hot-toast';
import ImageUploader from '@/components/admin/ImageUploader';
import { defaultTickerMessages, defaultHotspotSpots } from '@/lib/giftFinderResolve';

export default function AdminHomeGiftSettings({ form, setForm }) {
  const updateSpot = (i, field, val) => {
    setForm((p) => {
      const next = [...(p.hotspotSpots || [])];
      next[i] = { ...next[i], [field]: val };
      return { ...p, hotspotSpots: next };
    });
  };
  const addSpot = () => setForm((p) => ({ ...p, hotspotSpots: [...(p.hotspotSpots || []), { label: '', href: '/shop', top: '40%', left: '50%' }] }));
  const removeSpot = (i) => setForm((p) => ({ ...p, hotspotSpots: (p.hotspotSpots || []).filter((_, j) => j !== i) }));

  return (
    <>
      <div className="bg-white p-6 rounded-xl border space-y-4">
        <h2 className="font-bold text-lg">Homepage featured &amp; collections</h2>
        <p className="text-sm text-gray-500">These strings appear on the public homepage. Empty fields stay hidden on the storefront.</p>
        <div><label className="block text-sm font-medium mb-1">Hero eyebrow</label><input value={form.heroEyebrow} onChange={(e) => setForm((p) => ({ ...p, heroEyebrow: e.target.value }))} className="w-full border rounded-lg px-4 py-2" placeholder="Personalized gifts made in India" /></div>
        <div><label className="block text-sm font-medium mb-1">Hero trust badges (one per line)</label><textarea value={form.heroTrustBadgesText} onChange={(e) => setForm((p) => ({ ...p, heroTrustBadgesText: e.target.value }))} className="w-full border rounded-lg px-4 py-2" rows={3} placeholder={"Free shipping above INR 499\n100% customized gifts\nMade with care"} /></div>
        <div className="grid md:grid-cols-2 gap-4">
          <div><label className="block text-sm font-medium mb-1">Collections eyebrow</label><input value={form.homeCollectionsEyebrow} onChange={(e) => setForm((p) => ({ ...p, homeCollectionsEyebrow: e.target.value }))} className="w-full border rounded-lg px-4 py-2" /></div>
          <div><label className="block text-sm font-medium mb-1">Collections title</label><input value={form.homeCollectionsTitle} onChange={(e) => setForm((p) => ({ ...p, homeCollectionsTitle: e.target.value }))} className="w-full border rounded-lg px-4 py-2" /></div>
        </div>
        <div><label className="block text-sm font-medium mb-1">Collections subtitle</label><input value={form.homeCollectionsSubtitle} onChange={(e) => setForm((p) => ({ ...p, homeCollectionsSubtitle: e.target.value }))} className="w-full border rounded-lg px-4 py-2" /></div>
        <div><label className="block text-sm font-medium mb-1">Collections card button text</label><input value={form.homeCollectionsButtonText} onChange={(e) => setForm((p) => ({ ...p, homeCollectionsButtonText: e.target.value }))} className="w-full border rounded-lg px-4 py-2" placeholder="Shop now" /></div>
        <div><label className="block text-sm font-medium mb-1">Featured products eyebrow</label><input value={form.homeFeaturedProductsEyebrow} onChange={(e) => setForm((p) => ({ ...p, homeFeaturedProductsEyebrow: e.target.value }))} className="w-full border rounded-lg px-4 py-2" /></div>
        <div><label className="block text-sm font-medium mb-1">Featured products section title</label><input value={form.homeFeaturedProductsTitle} onChange={(e) => setForm((p) => ({ ...p, homeFeaturedProductsTitle: e.target.value }))} className="w-full border rounded-lg px-4 py-2" /></div>
        <div><label className="block text-sm font-medium mb-1">Featured products subtitle</label><input value={form.homeFeaturedProductsSubtitle} onChange={(e) => setForm((p) => ({ ...p, homeFeaturedProductsSubtitle: e.target.value }))} className="w-full border rounded-lg px-4 py-2" /></div>
        <div><label className="block text-sm font-medium mb-1">Featured products button text</label><input value={form.homeFeaturedProductsButtonText} onChange={(e) => setForm((p) => ({ ...p, homeFeaturedProductsButtonText: e.target.value }))} className="w-full border rounded-lg px-4 py-2" placeholder="Explore products" /></div>
        <div className="grid md:grid-cols-2 gap-4">
          <div><label className="block text-sm font-medium mb-1">Best Sellers eyebrow</label><input value={form.homeBestSellersEyebrow} onChange={(e) => setForm((p) => ({ ...p, homeBestSellersEyebrow: e.target.value }))} className="w-full border rounded-lg px-4 py-2" placeholder="Best sellers" /></div>
          <div><label className="block text-sm font-medium mb-1">Best Sellers title</label><input value={form.homeBestSellersTitle} onChange={(e) => setForm((p) => ({ ...p, homeBestSellersTitle: e.target.value }))} className="w-full border rounded-lg px-4 py-2" placeholder="Customer Favourite Gifts" /></div>
        </div>
        <div><label className="block text-sm font-medium mb-1">Best Sellers subtitle</label><input value={form.homeBestSellersSubtitle} onChange={(e) => setForm((p) => ({ ...p, homeBestSellersSubtitle: e.target.value }))} className="w-full border rounded-lg px-4 py-2" /></div>
        <div><label className="block text-sm font-medium mb-1">Best Sellers button text</label><input value={form.homeBestSellersButtonText} onChange={(e) => setForm((p) => ({ ...p, homeBestSellersButtonText: e.target.value }))} className="w-full border rounded-lg px-4 py-2" placeholder="View Best Sellers" /></div>

        <div className="grid md:grid-cols-2 gap-4 border-t pt-4">
          <div><label className="block text-sm font-medium mb-1">Limited Offers eyebrow</label><input value={form.homeOffersEyebrow} onChange={(e) => setForm((p) => ({ ...p, homeOffersEyebrow: e.target.value }))} className="w-full border rounded-lg px-4 py-2" placeholder="Limited offers" /></div>
          <div><label className="block text-sm font-medium mb-1">Limited Offers title</label><input value={form.homeOffersTitle} onChange={(e) => setForm((p) => ({ ...p, homeOffersTitle: e.target.value }))} className="w-full border rounded-lg px-4 py-2" placeholder="Limited Time Offers" /></div>
        </div>
        <div><label className="block text-sm font-medium mb-1">Limited Offers subtitle</label><input value={form.homeOffersSubtitle} onChange={(e) => setForm((p) => ({ ...p, homeOffersSubtitle: e.target.value }))} className="w-full border rounded-lg px-4 py-2" /></div>
        <div><label className="block text-sm font-medium mb-1">Limited Offers button text</label><input value={form.homeOffersButtonText} onChange={(e) => setForm((p) => ({ ...p, homeOffersButtonText: e.target.value }))} className="w-full border rounded-lg px-4 py-2" placeholder="View Offers" /></div>

        <div className="grid md:grid-cols-2 gap-4 border-t pt-4">
          <div><label className="block text-sm font-medium mb-1">All Products eyebrow</label><input value={form.homeAllProductsEyebrow} onChange={(e) => setForm((p) => ({ ...p, homeAllProductsEyebrow: e.target.value }))} className="w-full border rounded-lg px-4 py-2" /></div>
          <div><label className="block text-sm font-medium mb-1">All Products title</label><input value={form.homeAllProductsTitle} onChange={(e) => setForm((p) => ({ ...p, homeAllProductsTitle: e.target.value }))} className="w-full border rounded-lg px-4 py-2" placeholder="All Products" /></div>
        </div>
        <div><label className="block text-sm font-medium mb-1">All Products subtitle</label><input value={form.homeAllProductsSubtitle} onChange={(e) => setForm((p) => ({ ...p, homeAllProductsSubtitle: e.target.value }))} className="w-full border rounded-lg px-4 py-2" /></div>
        <div><label className="block text-sm font-medium mb-1">All Products button text</label><input value={form.homeAllProductsButtonText} onChange={(e) => setForm((p) => ({ ...p, homeAllProductsButtonText: e.target.value }))} className="w-full border rounded-lg px-4 py-2" placeholder="Explore Products" /></div>

        <div><label className="block text-sm font-medium mb-1">Collection showcase slug</label><input value={form.collectionShowcaseSlug} onChange={(e) => setForm((p) => ({ ...p, collectionShowcaseSlug: e.target.value }))} className="w-full border rounded-lg px-4 py-2 font-mono text-sm" placeholder="bottle-of-emotions" /></div>
        <div><label className="block text-sm font-medium mb-1">Collection showcase optional main title</label><input value={form.collectionShowcaseTitle} onChange={(e) => setForm((p) => ({ ...p, collectionShowcaseTitle: e.target.value }))} className="w-full border rounded-lg px-4 py-2" placeholder="Leave empty to hide" /></div>
        <div><label className="block text-sm font-medium mb-1">Collection showcase link subtitle</label><input value={form.collectionShowcaseSubtitle} onChange={(e) => setForm((p) => ({ ...p, collectionShowcaseSubtitle: e.target.value }))} className="w-full border rounded-lg px-4 py-2" /></div>
      </div>

      <div className="bg-white p-6 rounded-xl border space-y-4">
        <h2 className="font-bold text-lg">Scrolling ticker (homepage)</h2>
        <p className="text-sm text-gray-500">One message per line. Use <code className="bg-gray-100 px-1 rounded">{'{{threshold}}'}</code> for the free-shipping amount (INR).</p>
        <textarea value={form.tickerMessagesText} onChange={(e) => setForm((p) => ({ ...p, tickerMessagesText: e.target.value }))} className="w-full border rounded-lg px-4 py-2 font-mono text-sm" rows={8} />
        <button type="button" className="text-sm text-primary-600 underline" onClick={() => setForm((p) => ({ ...p, tickerMessagesText: defaultTickerMessages().join('\n') }))}>Reset ticker lines to default</button>
      </div>

      <div className="bg-white p-6 rounded-xl border space-y-4">
        <h2 className="font-bold text-lg">Before / after slider</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div><label className="block text-sm font-medium mb-1">Title</label><input value={form.beforeAfterTitle} onChange={(e) => setForm((p) => ({ ...p, beforeAfterTitle: e.target.value }))} className="w-full border rounded-lg px-4 py-2" /></div>
          <div><label className="block text-sm font-medium mb-1">Quote / description</label><input value={form.beforeAfterDescription} onChange={(e) => setForm((p) => ({ ...p, beforeAfterDescription: e.target.value }))} className="w-full border rounded-lg px-4 py-2" /></div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div><label className="block text-sm font-medium mb-1">Before image</label><ImageUploader images={form.beforeAfterImageBefore ? [form.beforeAfterImageBefore] : []} onChange={(imgs) => setForm((p) => ({ ...p, beforeAfterImageBefore: imgs[0] || '' }))} /></div>
          <div><label className="block text-sm font-medium mb-1">After image</label><ImageUploader images={form.beforeAfterImageAfter ? [form.beforeAfterImageAfter] : []} onChange={(imgs) => setForm((p) => ({ ...p, beforeAfterImageAfter: imgs[0] || '' }))} /></div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border space-y-4">
        <h2 className="font-bold text-lg">Hotspot banner</h2>
        <div><label className="block text-sm font-medium mb-1">Section title</label><input value={form.hotspotBannerTitle} onChange={(e) => setForm((p) => ({ ...p, hotspotBannerTitle: e.target.value }))} className="w-full border rounded-lg px-4 py-2" /></div>
        <div><label className="block text-sm font-medium mb-1">Background image</label><ImageUploader images={form.hotspotBannerImage ? [form.hotspotBannerImage] : []} onChange={(imgs) => setForm((p) => ({ ...p, hotspotBannerImage: imgs[0] || '' }))} /></div>
        <p className="text-sm text-gray-500">Hotspots (clickable pins). Use CSS positions e.g. top 40%, left 50%.</p>
        {(form.hotspotSpots || []).map((spot, i) => (
          <div key={i} className="grid md:grid-cols-5 gap-2 items-end border rounded-lg p-3 bg-gray-50">
            <div><label className="text-xs font-medium">Label</label><input value={spot.label} onChange={(e) => updateSpot(i, 'label', e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm" /></div>
            <div><label className="text-xs font-medium">Link</label><input value={spot.href} onChange={(e) => updateSpot(i, 'href', e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm" /></div>
            <div><label className="text-xs font-medium">Top</label><input value={spot.top} onChange={(e) => updateSpot(i, 'top', e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm" /></div>
            <div><label className="text-xs font-medium">Left</label><input value={spot.left} onChange={(e) => updateSpot(i, 'left', e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm" /></div>
            <button type="button" className="text-red-600 text-sm py-2" onClick={() => removeSpot(i)}>Remove</button>
          </div>
        ))}
        <div className="flex gap-2">
          <button type="button" className="px-3 py-1.5 border rounded-lg text-sm" onClick={addSpot}>Add hotspot</button>
          <button type="button" className="px-3 py-1.5 border rounded-lg text-sm" onClick={() => setForm((p) => ({ ...p, hotspotSpots: defaultHotspotSpots() }))}>Load 3 starter pins</button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border space-y-4">
        <h2 className="font-bold text-lg">Newsletter (footer)</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div><label className="block text-sm font-medium mb-1">Badge label</label><input value={form.newsletterBadge} onChange={(e) => setForm((p) => ({ ...p, newsletterBadge: e.target.value }))} className="w-full border rounded-lg px-4 py-2" /></div>
          <div><label className="block text-sm font-medium mb-1">Email placeholder</label><input value={form.newsletterPlaceholder} onChange={(e) => setForm((p) => ({ ...p, newsletterPlaceholder: e.target.value }))} className="w-full border rounded-lg px-4 py-2" /></div>
        </div>
        <div><label className="block text-sm font-medium mb-1">Heading</label><input value={form.newsletterTitle} onChange={(e) => setForm((p) => ({ ...p, newsletterTitle: e.target.value }))} className="w-full border rounded-lg px-4 py-2" /></div>
        <div><label className="block text-sm font-medium mb-1">Subtitle</label><textarea value={form.newsletterSubtitle} onChange={(e) => setForm((p) => ({ ...p, newsletterSubtitle: e.target.value }))} className="w-full border rounded-lg px-4 py-2" rows={2} /></div>
      </div>

    </>
  );
}

