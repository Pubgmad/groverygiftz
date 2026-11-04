'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function DesignPreviewPage() {
  const params = useParams();
  const token = params?.token;
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');

  useEffect(() => {
    if (!token) return;
    fetch(`/api/design-preview/${encodeURIComponent(token)}`, { cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Unable to load preview');
        setPreview(data.preview);
      })
      .catch((err) => setError(err.message || 'Unable to load preview'));
  }, [token]);

  const act = async (action) => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/design-preview/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, feedback }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');
      setDone(action === 'approve' ? 'Thank you! Your design is approved.' : 'Thanks — we received your feedback.');
      setPreview((prev) => prev ? { ...prev, designApprovalStatus: data.designApprovalStatus } : prev);
    } catch (err) {
      setError(err.message || 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-white px-4 py-8">
      <div className="mx-auto max-w-lg rounded-2xl border bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-primary-700">GroveryGiftz</p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">Design preview</h1>
        {error ? <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
        {!preview && !error ? <p className="mt-6 text-sm text-gray-500">Loading preview…</p> : null}
        {preview ? (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-gray-600">Order <span className="font-bold text-gray-900">{preview.orderNumber}</span> · Version {preview.currentDesignVersion}</p>
            <p className="text-sm">Status: <span className="font-semibold">{preview.designApprovalStatus}</span></p>
            {preview.design?.url ? (
              <a href={preview.design.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview.design.url} alt="Design preview" className="max-h-[70vh] w-full object-contain bg-gray-50" />
              </a>
            ) : (
              <p className="text-sm text-gray-500">No design image available.</p>
            )}
            {done ? (
              <p className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-900">{done}</p>
            ) : (
              <>
                <label className="block text-sm font-semibold text-gray-800">
                  Feedback (required for changes)
                  <textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    rows={3}
                    className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                    placeholder="Tell us what to change…"
                  />
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => act('approve')}
                    className="min-h-[48px] rounded-xl bg-primary-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
                  >
                    Approve Design
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => act('request_changes')}
                    className="min-h-[48px] rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-950 disabled:opacity-60"
                  >
                    Request Changes
                  </button>
                </div>
              </>
            )}
          </div>
        ) : null}
      </div>
    </main>
  );
}
