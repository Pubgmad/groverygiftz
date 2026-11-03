'use client';

import { FiPlus, FiX, FiUpload, FiLoader, FiArrowUp, FiArrowDown, FiVideo, FiImage } from 'react-icons/fi';
import ImageUploader from '@/components/admin/ImageUploader';
import toast from 'react-hot-toast';
import { useState } from 'react';

const moveItem = (list, index, direction) => {
  const next = [...list];
  const target = index + direction;
  if (target < 0 || target >= next.length) return list;
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item);
  return next.map((row, sortOrder) => ({ ...row, sortOrder }));
};

export function ProductFaqEditor({ faqs = [], onChange }) {
  const rows = Array.isArray(faqs) ? faqs : [];
  const update = (index, patch) => onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  return (
    <div className="rounded-xl border border-primary-100 bg-primary-50/30 p-4 space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">Frequently Asked Questions</h3>
          <p className="text-xs text-gray-500">Shared across all product pages in About This Product. Supports basic HTML: &lt;b&gt;, &lt;i&gt;, &lt;ul&gt;, &lt;ol&gt;, &lt;a&gt;, paragraphs.</p>
        </div>
        <button
          type="button"
          onClick={() => onChange([...rows, { question: '', answer: '', sortOrder: rows.length, isActive: true }])}
          className="inline-flex items-center justify-center gap-1 rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white"
        >
          <FiPlus /> Add FAQ
        </button>
      </div>
      {rows.length === 0 ? <p className="rounded-lg bg-white px-4 py-3 text-sm text-gray-500">No FAQs yet.</p> : null}
      {rows.map((faq, index) => (
        <div key={index} className="rounded-xl border bg-white p-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-gray-800">FAQ {index + 1}</p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => onChange(moveItem(rows, index, -1))} className="rounded border px-2 py-1 text-gray-600" aria-label="Move up"><FiArrowUp /></button>
              <button type="button" onClick={() => onChange(moveItem(rows, index, 1))} className="rounded border px-2 py-1 text-gray-600" aria-label="Move down"><FiArrowDown /></button>
              <label className="flex items-center gap-1 text-xs text-gray-600">
                <input type="checkbox" checked={faq.isActive !== false} onChange={(e) => update(index, { isActive: e.target.checked })} />
                Active
              </label>
              <button type="button" onClick={() => onChange(rows.filter((_, i) => i !== index))} className="text-red-500"><FiX /></button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Question</label>
            <input value={faq.question || ''} onChange={(e) => update(index, { question: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="How long does preparation take?" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Answer</label>
            <textarea value={faq.answer || ''} onChange={(e) => update(index, { answer: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" rows={4} placeholder="We prepare most gifts within 1–2 business days..." />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProductMakingVideosEditor({ section = {}, videos = [], onSectionChange, onVideosChange }) {
  const rows = Array.isArray(videos) ? videos : [];
  const [uploadingIndex, setUploadingIndex] = useState(null);

  const update = (index, patch) => onVideosChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const uploadVideo = async (index, file) => {
    if (!file) return;
    setUploadingIndex(index);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload/video', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Video upload failed');
      update(index, { url: data.url, name: data.name || file.name });
      toast.success('Video uploaded');
    } catch (error) {
      toast.error(error.message || 'Video upload failed');
    } finally {
      setUploadingIndex(null);
    }
  };

  return (
    <div className="bg-white p-4 sm:p-6 rounded-xl border space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-bold text-lg flex items-center gap-2"><FiVideo className="text-primary-600" /> Product-Making Videos</h2>
          <p className="text-sm text-gray-500 mt-1">Shown after Customer Submitted Reviews. Upload multiple workshop videos with titles and thumbnails.</p>
        </div>
        <button
          type="button"
          onClick={() => onVideosChange([...rows, { url: '', name: '', poster: '', title: '', description: '', sortOrder: rows.length, isActive: true }])}
          className="inline-flex items-center justify-center gap-1 rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white"
        >
          <FiPlus /> Add Video
        </button>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={section.enabled !== false} onChange={(e) => onSectionChange({ ...section, enabled: e.target.checked })} />
          Show this section on the product page
        </label>
        <div>
          <label className="block text-sm font-medium mb-1">Section heading</label>
          <input
            value={section.heading || ''}
            onChange={(e) => onSectionChange({ ...section, heading: e.target.value })}
            className="w-full border rounded-lg px-4 py-2"
            placeholder="See How Your Gift Is Made"
          />
        </div>
      </div>
      {rows.length === 0 ? <p className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-500">No making videos yet.</p> : null}
      {rows.map((video, index) => (
        <div key={index} className="rounded-xl border bg-gray-50 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-sm text-gray-800">Video {index + 1}</p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => onVideosChange(moveItem(rows, index, -1))} className="rounded border bg-white px-2 py-1"><FiArrowUp /></button>
              <button type="button" onClick={() => onVideosChange(moveItem(rows, index, 1))} className="rounded border bg-white px-2 py-1"><FiArrowDown /></button>
              <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={video.isActive !== false} onChange={(e) => update(index, { isActive: e.target.checked })} /> Active</label>
              <button type="button" onClick={() => onVideosChange(rows.filter((_, i) => i !== index))} className="text-red-500"><FiX /></button>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Title</label>
              <input value={video.title || ''} onChange={(e) => update(index, { title: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm bg-white" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Short description</label>
              <input value={video.description || ''} onChange={(e) => update(index, { description: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm bg-white" />
            </div>
          </div>
          {video.url ? (
            <div className="rounded-lg border bg-white p-3">
              <video src={video.url} controls className="w-full max-h-64 rounded-lg bg-black" preload="metadata" />
              <p className="mt-2 truncate text-xs text-gray-500">{video.name || video.url}</p>
              <button type="button" className="mt-2 text-sm text-red-500" onClick={() => update(index, { url: '', name: '' })}>Remove video file</button>
            </div>
          ) : (
            <label className={`relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary-200 bg-white px-4 py-6 text-center ${uploadingIndex === index ? 'pointer-events-none opacity-80' : ''}`}>
              {uploadingIndex === index ? <FiLoader size={24} className="animate-spin text-primary-600" /> : <FiUpload size={22} className="text-primary-600" />}
              <span className="text-sm font-semibold">{uploadingIndex === index ? 'Uploading...' : 'Upload video'}</span>
              <span className="text-xs text-gray-500">MP4, WEBM or MOV up to 100 MB</span>
              <input type="file" accept="video/mp4,video/webm,video/quicktime" className="sr-only" disabled={uploadingIndex === index} onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; uploadVideo(index, file); }} />
            </label>
          )}
          <div>
            <p className="mb-2 flex items-center gap-1 text-xs font-medium text-gray-700"><FiImage /> Thumbnail / poster</p>
            <ImageUploader module="products" images={video.poster ? [video.poster] : []} onChange={(imgs) => update(index, { poster: imgs[0] || '' })} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProductStockAlertEditor({ stockAlert = {}, onChange }) {
  const value = stockAlert || {};
  return (
    <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-4 space-y-3">
      <h3 className="font-semibold text-gray-900">Low-stock urgency alert</h3>
      <p className="text-xs text-gray-500">Shown near the price in addition to the original stock display. Uses real inventory. Use {'{count}'} for the quantity.</p>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={value.enabled !== false} onChange={(e) => onChange({ ...value, enabled: e.target.checked })} />
        Show animated low-stock alert
      </label>
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1">Low-stock threshold</label>
          <input type="number" min="1" value={value.lowStockThreshold ?? 5} onChange={(e) => onChange({ ...value, lowStockThreshold: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm bg-white" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Alert label</label>
          <input value={value.lowStockLabel || ''} onChange={(e) => onChange({ ...value, lowStockLabel: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm bg-white" placeholder="Hurry! Only {count} left in stock" />
        </div>
      </div>
    </div>
  );
}

export function ProductPurchaseActivityEditor({ purchaseActivity = {}, onChange }) {
  const value = purchaseActivity || {};
  return (
    <div className="rounded-xl border border-primary-100 bg-primary-50/30 p-4 space-y-3">
      <h3 className="font-semibold text-gray-900">Purchase activity indicator</h3>
      <p className="text-xs text-gray-500">Admin-entered promotional values for this product only — not calculated from orders. Use {'{count}'}, {'{time}'}, and {'{unit}'} in the optional template.</p>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={!!value.enabled} onChange={(e) => onChange({ ...value, enabled: e.target.checked })} />
        Show purchase activity on product page
      </label>
      <div className="grid md:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1">Purchase count</label>
          <input type="number" min="0" value={value.purchaseCount ?? 0} onChange={(e) => onChange({ ...value, purchaseCount: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm bg-white" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Time quantity</label>
          <input type="number" min="1" value={value.timeQuantity ?? 24} onChange={(e) => onChange({ ...value, timeQuantity: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm bg-white" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Time unit</label>
          <select value={value.timeUnit || 'hours'} onChange={(e) => onChange({ ...value, timeUnit: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm bg-white">
            <option value="hours">Hours</option>
            <option value="days">Days</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium mb-1">Optional label template</label>
        <input value={value.labelTemplate || ''} onChange={(e) => onChange({ ...value, labelTemplate: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm bg-white" placeholder="{count} people purchased this product in the last {time} {unit}" />
      </div>
    </div>
  );
}
