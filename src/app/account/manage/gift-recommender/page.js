'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import AdminGiftRecommenderSettings from '@/components/admin/AdminGiftRecommenderSettings';
import { resolveGiftFinderForUi } from '@/lib/giftFinderResolve';

export default function AdminGiftRecommenderPage() {
  const [form, setForm] = useState({
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
    fetch('/api/settings')
      .then((res) => res.json())
      .then((settings) => {
        const resolved = resolveGiftFinderForUi(settings);
        setForm({
          giftFinderStillConfused: settings.giftFinderStillConfused ?? '',
          giftFinderTryLine: settings.giftFinderTryLine ?? '',
          giftFinderDescription: settings.giftFinderDescription ?? '',
          giftFinderOccasions: settings.giftFinderOccasions?.length ? settings.giftFinderOccasions : resolved.occasions,
          giftFinderTypes: settings.giftFinderTypes?.length ? settings.giftFinderTypes : resolved.types,
          giftFinderQuickPicks: settings.giftFinderQuickPicks?.length ? settings.giftFinderQuickPicks : resolved.quickPicks,
        });
      })
      .catch(() => toast.error('Unable to load Gift Recommender settings'))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    const payload = {
      giftFinderStillConfused: form.giftFinderStillConfused || '',
      giftFinderTryLine: form.giftFinderTryLine || '',
      giftFinderDescription: form.giftFinderDescription || '',
      giftFinderOccasions: (form.giftFinderOccasions || []).filter((row) => row.value?.trim() && row.label?.trim()),
      giftFinderTypes: (form.giftFinderTypes || []).filter((row) => row.value?.trim() && row.label?.trim()),
      giftFinderQuickPicks: (form.giftFinderQuickPicks || []).filter((row) => row.label?.trim()),
    };
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) toast.success('Gift Recommender settings saved!');
    else toast.error('Failed to save Gift Recommender settings');
  };

  if (loading) return <div className="text-center py-12">Loading...</div>;

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Gift Recommender</h1>
        <p className="mt-1 text-sm text-gray-500">Manage the storefront Gift Recommender options and quick-pick chips.</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-6">
        <AdminGiftRecommenderSettings form={form} setForm={setForm} />
        <button type="submit" disabled={saving} className="w-full sm:w-auto bg-primary-600 text-white px-6 sm:px-8 py-3 rounded-lg font-semibold hover:bg-primary-700 disabled:opacity-70">
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </form>
    </div>
  );
}
