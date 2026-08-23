'use client';
import toast from 'react-hot-toast';
import { resolveGiftFinderForUi } from '@/lib/giftFinderResolve';

export default function AdminGiftRecommenderSettings({ form, setForm }) {
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

  return (
    <div className="bg-white p-4 sm:p-6 rounded-xl border space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-bold text-lg">Gift Recommender</h2>
        <button type="button" className="w-full sm:w-auto text-sm px-3 py-2 bg-primary-50 text-primary-700 rounded-lg border border-primary-200" onClick={resetGiftFinderLists}>Reset lists to defaults</button>
      </div>
      <p className="text-sm text-gray-500">Leave intro fields empty to use built-in storefront defaults. Occasion/type <strong>value</strong> is the URL param (lowercase, hyphens). <strong>Keywords</strong> (comma-separated) power /search when that filter is chosen.</p>
      <div className="grid gap-3">
        <div><label className="block text-sm font-medium mb-1">Headline - &quot;Still confused?&quot;</label><input value={form.giftFinderStillConfused} onChange={(e) => setForm((p) => ({ ...p, giftFinderStillConfused: e.target.value }))} className="w-full border rounded-lg px-4 py-2" placeholder="Empty = default" /></div>
        <div><label className="block text-sm font-medium mb-1">Accent line - &quot;Try our...&quot;</label><input value={form.giftFinderTryLine} onChange={(e) => setForm((p) => ({ ...p, giftFinderTryLine: e.target.value }))} className="w-full border rounded-lg px-4 py-2" placeholder="Empty = default" /></div>
        <div><label className="block text-sm font-medium mb-1">Description paragraph</label><textarea value={form.giftFinderDescription} onChange={(e) => setForm((p) => ({ ...p, giftFinderDescription: e.target.value }))} className="w-full border rounded-lg px-4 py-2" rows={3} placeholder="Empty = default" /></div>
      </div>

      <h3 className="font-semibold text-sm pt-2">Occasions</h3>
      {(form.giftFinderOccasions || []).map((row, i) => (
        <div key={i} className="grid gap-2 border rounded-lg p-3 bg-gray-50 md:grid-cols-4 md:items-end">
          <div><label className="text-xs font-medium">Value (slug)</label><input value={row.value} onChange={(e) => updateOccasion(i, 'value', e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm font-mono" /></div>
          <div><label className="text-xs font-medium">Label (shown)</label><input value={row.label} onChange={(e) => updateOccasion(i, 'label', e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm" /></div>
          <div className="md:col-span-2"><label className="text-xs font-medium">Keywords</label><input value={row.keywords} onChange={(e) => updateOccasion(i, 'keywords', e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm" placeholder="birthday, bday" /></div>
          <button type="button" className="text-left text-red-600 text-sm md:text-center" onClick={() => removeOccasion(i)}>Remove</button>
        </div>
      ))}
      <button type="button" className="px-3 py-1.5 border rounded-lg text-sm" onClick={addOccasion}>Add occasion</button>

      <h3 className="font-semibold text-sm pt-4">Gift types</h3>
      {(form.giftFinderTypes || []).map((row, i) => (
        <div key={i} className="grid gap-2 border rounded-lg p-3 bg-gray-50 md:grid-cols-4 md:items-end">
          <div><label className="text-xs font-medium">Value</label><input value={row.value} onChange={(e) => updateType(i, 'value', e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm font-mono" /></div>
          <div><label className="text-xs font-medium">Label</label><input value={row.label} onChange={(e) => updateType(i, 'label', e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm" /></div>
          <div className="md:col-span-2"><label className="text-xs font-medium">Keywords</label><input value={row.keywords} onChange={(e) => updateType(i, 'keywords', e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm" /></div>
          <button type="button" className="text-left text-red-600 text-sm md:text-center" onClick={() => removeType(i)}>Remove</button>
        </div>
      ))}
      <button type="button" className="px-3 py-1.5 border rounded-lg text-sm" onClick={addType}>Add gift type</button>

      <h3 className="font-semibold text-sm pt-4">Quick-pick chips</h3>
      <p className="text-xs text-gray-500">Set either occasion or gift type (or both). Values must match rows above.</p>
      {(form.giftFinderQuickPicks || []).map((row, i) => (
        <div key={i} className="grid gap-2 border rounded-lg p-3 bg-gray-50 md:grid-cols-4 md:items-end">
          <div><label className="text-xs font-medium">Chip label</label><input value={row.label} onChange={(e) => updatePick(i, 'label', e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm" /></div>
          <div><label className="text-xs font-medium">Occasion value</label><input value={row.occasion || ''} onChange={(e) => updatePick(i, 'occasion', e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm font-mono" placeholder="birthday" /></div>
          <div><label className="text-xs font-medium">Gift type value</label><input value={row.giftType || ''} onChange={(e) => updatePick(i, 'giftType', e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm font-mono" /></div>
          <button type="button" className="text-left text-red-600 text-sm md:text-center" onClick={() => removePick(i)}>Remove</button>
        </div>
      ))}
      <button type="button" className="px-3 py-1.5 border rounded-lg text-sm" onClick={addPick}>Add quick pick</button>
    </div>
  );
}
