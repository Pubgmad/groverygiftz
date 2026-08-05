'use client';
import toast from 'react-hot-toast';
import ImageUploader from '@/components/admin/ImageUploader';
import { resolveGiftFinderForUi, defaultTickerMessages, defaultHotspotSpots } from '@/lib/giftFinderResolve';

export default function AdminHomeGiftSettings({ form, setForm }) {
  const resetGiftFinderLists = () => {
    const g = resolveGiftFinderForUi({});
    setForm((p) => ({
      ...p,
      giftFinderOccasions: g.occasions,
      giftFinderTypes: g.types,
      giftFinderQuickPicks: g.quickPicks,
    }));
    toast.success('Gift recommender lists reset to built-in defaults - click Save to persist.');
  };

  const updateOccasion = (i, field, val) => {
    setForm((p) => {
      const next = [...(p.giftFinderOccasions || [])];
      next[i] = { ...next[i], [field]: val };
      return { ...p, giftFinderOccasions: next };
    });
  };
  const addOccasion = () => setForm((p) => ({ ...p, giftFinderOccasions: [...(p.giftFinderOccasions || []), { value: '', label: '', keywords: '' }] }));
  const removeOccasion = (i) => setForm((p) => ({ ...p, giftFinderOccasions: (p.giftFinderOccasions || []).filter((_, j) => j !== i) }));

  const updateType = (i, field, val) => {
    setForm((p) => {
      const next = [...(p.giftFinderTypes || [])];
      next[i] = { ...next[i], [field]: val };
      return { ...p, giftFinderTypes: next };
    });
  };
  const addType = () => setForm((p) => ({ ...p, giftFinderTypes: [...(p.giftFinderTypes || []), { value: '', label: '', keywords: '' }] }));
  const removeType = (i) => setForm((p) => ({ ...p, giftFinderTypes: (p.giftFinderTypes || []).filter((_, j) => j !== i) }));

  const updatePick = (i, field, val) => {
    setForm((p) => {
      const next = [...(p.giftFinderQuickPicks || [])];
      next[i] = { ...next[i], [field]: val };
      return { ...p, giftFinderQuickPicks: next };
    });
  };
  const addPick = () => setForm((p) => ({ ...p, giftFinderQuickPicks: [...(p.giftFinderQuickPicks || []), { label: '', occasion: '', giftType: '' }] }));
  const removePick = (i) => setForm((p) => ({ ...p, giftFinderQuickPicks: (p.giftFinderQuickPicks || []).filter((_, j) => j !== i) }));

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

      <div className="bg-white p-6 rounded-xl border space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold text-lg">Gift Recommender</h2>
          <button type="button" className="text-sm px-3 py-1.5 bg-primary-50 text-primary-700 rounded-lg border border-primary-200" onClick={resetGiftFinderLists}>Reset lists to defaults</button>
        </div>
        <p className="text-sm text-gray-500">Leave intro fields empty to use built-in storefront defaults. Occasion/type <strong>value</strong> is the URL param (lowercase, hyphens). <strong>Keywords</strong> (comma-separated) power /search when that filter is chosen.</p>
        <div className="grid md:grid-cols-1 gap-3">
          <div><label className="block text-sm font-medium mb-1">Headline - "Still confused?"</label><input value={form.giftFinderStillConfused} onChange={(e) => setForm((p) => ({ ...p, giftFinderStillConfused: e.target.value }))} className="w-full border rounded-lg px-4 py-2" placeholder="Empty = default" /></div>
          <div><label className="block text-sm font-medium mb-1">Accent line - "Try our..."</label><input value={form.giftFinderTryLine} onChange={(e) => setForm((p) => ({ ...p, giftFinderTryLine: e.target.value }))} className="w-full border rounded-lg px-4 py-2" placeholder="Empty = default" /></div>
          <div><label className="block text-sm font-medium mb-1">Description paragraph</label><textarea value={form.giftFinderDescription} onChange={(e) => setForm((p) => ({ ...p, giftFinderDescription: e.target.value }))} className="w-full border rounded-lg px-4 py-2" rows={3} placeholder="Empty = default" /></div>
        </div>

        <h3 className="font-semibold text-sm pt-2">Occasions</h3>
        {(form.giftFinderOccasions || []).map((row, i) => (
          <div key={i} className="grid md:grid-cols-4 gap-2 items-end border rounded-lg p-3 bg-gray-50">
            <div><label className="text-xs font-medium">Value (slug)</label><input value={row.value} onChange={(e) => updateOccasion(i, 'value', e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm font-mono" /></div>
            <div className="md:col-span-1"><label className="text-xs font-medium">Label (shown)</label><input value={row.label} onChange={(e) => updateOccasion(i, 'label', e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm" /></div>
            <div className="md:col-span-2"><label className="text-xs font-medium">Keywords</label><input value={row.keywords} onChange={(e) => updateOccasion(i, 'keywords', e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm" placeholder="birthday, bday" /></div>
            <button type="button" className="text-red-600 text-sm" onClick={() => removeOccasion(i)}>Remove</button>
          </div>
        ))}
        <button type="button" className="px-3 py-1.5 border rounded-lg text-sm" onClick={addOccasion}>Add occasion</button>

        <h3 className="font-semibold text-sm pt-4">Gift types</h3>
        {(form.giftFinderTypes || []).map((row, i) => (
          <div key={i} className="grid md:grid-cols-4 gap-2 items-end border rounded-lg p-3 bg-gray-50">
            <div><label className="text-xs font-medium">Value</label><input value={row.value} onChange={(e) => updateType(i, 'value', e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm font-mono" /></div>
            <div><label className="text-xs font-medium">Label</label><input value={row.label} onChange={(e) => updateType(i, 'label', e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm" /></div>
            <div className="md:col-span-2"><label className="text-xs font-medium">Keywords</label><input value={row.keywords} onChange={(e) => updateType(i, 'keywords', e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm" /></div>
            <button type="button" className="text-red-600 text-sm" onClick={() => removeType(i)}>Remove</button>
          </div>
        ))}
        <button type="button" className="px-3 py-1.5 border rounded-lg text-sm" onClick={addType}>Add gift type</button>

        <h3 className="font-semibold text-sm pt-4">Quick-pick chips</h3>
        <p className="text-xs text-gray-500">Set either occasion or gift type (or both). Values must match rows above.</p>
        {(form.giftFinderQuickPicks || []).map((row, i) => (
          <div key={i} className="grid md:grid-cols-4 gap-2 items-end border rounded-lg p-3 bg-gray-50">
            <div><label className="text-xs font-medium">Chip label</label><input value={row.label} onChange={(e) => updatePick(i, 'label', e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm" /></div>
            <div><label className="text-xs font-medium">Occasion value</label><input value={row.occasion || ''} onChange={(e) => updatePick(i, 'occasion', e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm font-mono" placeholder="birthday" /></div>
            <div><label className="text-xs font-medium">Gift type value</label><input value={row.giftType || ''} onChange={(e) => updatePick(i, 'giftType', e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm font-mono" /></div>
            <button type="button" className="text-red-600 text-sm" onClick={() => removePick(i)}>Remove</button>
          </div>
        ))}
        <button type="button" className="px-3 py-1.5 border rounded-lg text-sm" onClick={addPick}>Add quick pick</button>
      </div>
    </>
  );
}

