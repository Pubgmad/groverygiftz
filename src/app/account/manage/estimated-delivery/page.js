'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { validateDeliveryEstimate } from '@/lib/centralDeliveryEstimates';

const emptyEstimates = { tamilNaduDeliveryEstimate: '', otherStateDeliveryEstimate: '' };

function readEstimates(data) {
  if (typeof data?.tamilNaduDeliveryEstimate !== 'string' || typeof data?.otherStateDeliveryEstimate !== 'string') {
    throw new Error('Unable to read delivery estimates');
  }
  return {
    tamilNaduDeliveryEstimate: data.tamilNaduDeliveryEstimate,
    otherStateDeliveryEstimate: data.otherStateDeliveryEstimate,
  };
}

export default function EstimatedDeliveryPage() {
  const [form, setForm] = useState(emptyEstimates);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch('/api/delivery-estimates', { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error('Unable to load delivery estimates');
        const estimates = readEstimates(await response.json());
        if (controller.signal.aborted) return;
        setForm(estimates);
        setLoaded(true);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err.message || 'Unable to load delivery estimates');
        toast.error(err.message || 'Unable to load delivery estimates');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!loaded || saving) return;
    const tamilNaduDeliveryEstimate = validateDeliveryEstimate(form.tamilNaduDeliveryEstimate);
    const otherStateDeliveryEstimate = validateDeliveryEstimate(form.otherStateDeliveryEstimate);
    if (tamilNaduDeliveryEstimate === null || otherStateDeliveryEstimate === null) {
      const message = 'Enter valid delivery estimates for Tamil Nadu and other states.';
      setError(message);
      toast.error(message);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/delivery-estimates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tamilNaduDeliveryEstimate, otherStateDeliveryEstimate }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Unable to save delivery estimates');
      setForm(readEstimates(data));
      window.dispatchEvent(new Event('groverygiftz:delivery-estimates'));
      try { window.localStorage.setItem('gg-delivery-estimates-updated', String(Date.now())); } catch {}
      toast.success('Delivery estimates saved!');
    } catch (err) {
      setError(err.message || 'Unable to save delivery estimates');
      toast.error(err.message || 'Unable to save delivery estimates');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold">Estimated Delivery Days</h1>
      <form onSubmit={handleSubmit} className="space-y-5" aria-busy={loading || saving}>
        {loading && <p role="status" className="text-sm text-gray-500">Loading...</p>}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div>
          <label htmlFor="tamil-nadu-estimate" className="mb-1 block text-sm font-medium">Tamil Nadu Estimated Delivery Days</label>
          <input id="tamil-nadu-estimate" type="text" required maxLength={80} value={form.tamilNaduDeliveryEstimate}
            onChange={event => setForm(previous => ({ ...previous, tamilNaduDeliveryEstimate: event.target.value }))}
            disabled={!loaded || saving} className="w-full min-w-0 rounded-lg border bg-white px-4 py-3 text-base disabled:opacity-60" />
        </div>
        <div>
          <label htmlFor="other-states-estimate" className="mb-1 block text-sm font-medium">Other States Estimated Delivery Days</label>
          <input id="other-states-estimate" type="text" required maxLength={80} value={form.otherStateDeliveryEstimate}
            onChange={event => setForm(previous => ({ ...previous, otherStateDeliveryEstimate: event.target.value }))}
            disabled={!loaded || saving} className="w-full min-w-0 rounded-lg border bg-white px-4 py-3 text-base disabled:opacity-60" />
        </div>
        <button type="submit" disabled={!loaded || saving}
          className="w-full rounded-lg bg-primary-600 px-6 py-3 font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
}
