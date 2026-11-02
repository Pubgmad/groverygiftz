'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export default function PhotoLimitDialog({
  open,
  max = 0,
  used = 0,
  remaining = 0,
  selectedCount = 0,
  files = [],
  onCancel,
  onUpload,
}) {
  const [picked, setPicked] = useState([]);

  useEffect(() => {
    if (!open) return;
    setPicked(files.slice(0, remaining).map((_, index) => index));
  }, [open, files, remaining]);

  if (!open || typeof document === 'undefined') return null;

  const toggle = (index) => {
    setPicked((prev) => {
      if (prev.includes(index)) return prev.filter((item) => item !== index);
      if (prev.length >= remaining) return prev;
      return [...prev, index];
    });
  };

  const chosen = picked.map((index) => files[index]).filter(Boolean);

  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-gray-950/50 p-3 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="photo-limit-title">
      <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-xl">
        <h2 id="photo-limit-title" className="font-display text-lg font-bold text-gray-950">Too many photos selected</h2>
        <p className="mt-2 text-sm leading-6 text-gray-600">
          This product allows {max} photo{max === 1 ? '' : 's'}. You already have {used} uploaded, so you can add {remaining} more. Please adjust your selection.
        </p>
        {remaining > 0 ? (
          <div className="mt-4 max-h-48 space-y-2 overflow-y-auto">
            {files.map((file, index) => {
              const checked = picked.includes(index);
              const disabled = !checked && picked.length >= remaining;
              return (
                <label key={`${file.name}-${index}`} className={`flex min-h-11 items-center gap-3 rounded-xl border px-3 py-2 text-sm ${checked ? 'border-primary-500 bg-primary-50' : 'border-gray-200'} ${disabled ? 'opacity-50' : ''}`}>
                  <input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggle(index)} className="h-4 w-4 accent-primary-600" />
                  <span className="min-w-0 truncate font-medium text-gray-800">{file.name || `Photo ${index + 1}`}</span>
                </label>
              );
            })}
          </div>
        ) : (
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">All frames are filled. Remove a photo first, or replace an existing photo.</p>
        )}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" onClick={onCancel} className="min-h-12 rounded-2xl border border-gray-200 text-sm font-bold text-gray-800">Cancel</button>
          {remaining > 0 ? (
            <button
              type="button"
              disabled={chosen.length === 0 || chosen.length > remaining}
              onClick={() => onUpload(chosen)}
              className="min-h-12 rounded-2xl bg-accent-500 text-sm font-bold text-white disabled:opacity-50"
            >
              Upload {chosen.length || 0}
            </button>
          ) : (
            <button type="button" onClick={onCancel} className="min-h-12 rounded-2xl bg-primary-600 text-sm font-bold text-white">OK</button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
