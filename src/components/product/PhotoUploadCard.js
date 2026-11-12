'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { FiLoader, FiUpload, FiX } from 'react-icons/fi';

export default function PhotoUploadCard({
  label,
  sizeLabel = '',
  required = false,
  missingRequired = false,
  photoUrl = '',
  fallbackUrls = [],
  uploading = false,
  disabled = false,
  accept = 'image/*,.heic,.heif',
  multiple = false,
  orientationLabel = '',
  aspectWidth = 1,
  aspectHeight = 1,
  fitMode = 'fit',
  onUpload,
  onRemove,
  onEdit,
  extraActions = null,
  instructions = '',
}) {
  const inputId = useId();
  const fileInputRef = useRef(null);
  const sources = useMemo(() => {
    const seen = new Set();
    const urls = [];
    for (const entry of [photoUrl, ...(Array.isArray(fallbackUrls) ? fallbackUrls : [])]) {
      const url = String(entry || '').trim();
      if (!url || seen.has(url)) continue;
      seen.add(url);
      urls.push(url);
    }
    return urls;
  }, [photoUrl, fallbackUrls]);

  const [srcIndex, setSrcIndex] = useState(0);
  const sourceKey = sources.join('\n');

  useEffect(() => {
    setSrcIndex(0);
  }, [sourceKey]);

  const activeSrc = sources[Math.min(srcIndex, Math.max(0, sources.length - 1))] || '';
  const hasPhoto = sources.length > 0;
  const ratioW = Math.max(1, Number(aspectWidth) || 1);
  const ratioH = Math.max(1, Number(aspectHeight) || 1);
  const interactive = !(uploading || disabled);

  const pickFiles = (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (files.length) onUpload?.(files);
  };

  const openPicker = () => {
    if (!interactive) return;
    fileInputRef.current?.click();
  };

  const openEditor = () => {
    if (!interactive) return;
    onEdit?.();
  };

  const stopCardAction = (event) => {
    event.stopPropagation();
  };

  const handleImageError = (event) => {
    if (srcIndex + 1 < sources.length) {
      event.currentTarget.style.visibility = '';
      setSrcIndex((index) => index + 1);
      return;
    }
    event.currentTarget.style.visibility = 'hidden';
  };

  const shellClass = `flex min-w-0 gap-3 overflow-hidden rounded-2xl border bg-white p-2.5 transition ${
    missingRequired ? 'border-red-400 ring-2 ring-red-100' : 'border-gray-200'
  } ${
    interactive
      ? 'cursor-pointer hover:border-primary-300 hover:bg-primary-50/40 active:scale-[0.995] focus-within:ring-2 focus-within:ring-primary-200'
      : 'opacity-70'
  }`;

  const preview = (
    <div
      className="relative w-20 shrink-0 overflow-hidden rounded-xl border border-dashed border-gray-200 bg-gray-50"
      style={{ aspectRatio: `${ratioW} / ${ratioH}`, maxHeight: '5.5rem' }}
    >
      <div className="flex h-full w-full items-center justify-center bg-white">
        {hasPhoto ? (
          <img
            key={activeSrc}
            src={activeSrc}
            alt=""
            className={`h-full w-full ${fitMode === 'fill' ? 'object-cover' : 'object-contain'}`}
            onError={handleImageError}
          />
        ) : (
          <span className="flex h-full w-full flex-col items-center justify-center gap-0.5 px-1 text-center" aria-hidden="true">
            {uploading ? <FiLoader className="animate-spin text-primary-600" size={18} /> : <FiUpload className="text-primary-600" size={18} />}
          </span>
        )}
      </div>
      {uploading ? (
        <span className="absolute inset-0 flex items-center justify-center bg-white/80">
          <FiLoader className="animate-spin text-primary-600" size={18} />
        </span>
      ) : null}
    </div>
  );

  const meta = (
    <div className="min-w-0">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-extrabold text-gray-950">{label}</p>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
          hasPhoto ? 'bg-emerald-50 text-emerald-700' : required ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-600'
        }`}>
          {hasPhoto ? 'Uploaded' : required ? 'Required' : 'Optional'}
        </span>
      </div>
      <p className="mt-0.5 truncate text-[11px] leading-4 text-gray-500">
        {[sizeLabel, orientationLabel].filter(Boolean).join(' · ') || (uploading ? 'Preparing your photo…' : missingRequired ? 'Photo required' : multiple ? 'Upload photos' : 'Upload photo')}
      </p>
    </div>
  );

  const fileInput = (
    <input
      ref={fileInputRef}
      id={inputId}
      type="file"
      accept={accept}
      multiple={multiple}
      className="sr-only"
      disabled={!interactive}
      aria-label={hasPhoto ? `Replace photo for ${label}` : `Upload photo for ${label}`}
      onClick={stopCardAction}
      onChange={pickFiles}
    />
  );

  if (!hasPhoto) {
    // Whole empty card is the upload target — one native label→input association, no nested handlers.
    return (
      <label
        htmlFor={inputId}
        aria-invalid={missingRequired || undefined}
        className={shellClass}
      >
        {fileInput}
        {preview}
        <div className="flex min-w-0 flex-1 flex-col justify-between">
          {meta}
          {uploading ? (
            <p className="text-[11px] font-semibold text-primary-700">Preparing your photo…</p>
          ) : missingRequired ? (
            <p className="text-[11px] font-semibold text-red-600" role="alert">Photo required</p>
          ) : null}
          {instructions ? <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-gray-500">{instructions}</p> : null}
        </div>
      </label>
    );
  }

  return (
    <article
      aria-invalid={missingRequired || undefined}
      role={typeof onEdit === 'function' && interactive ? 'button' : undefined}
      tabIndex={typeof onEdit === 'function' && interactive ? 0 : undefined}
      aria-label={typeof onEdit === 'function' ? `Edit ${label}` : label}
      className={shellClass}
      onClick={typeof onEdit === 'function' ? openEditor : undefined}
      onKeyDown={(event) => {
        if (typeof onEdit !== 'function' || !interactive) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openEditor();
        }
      }}
    >
      {fileInput}
      {preview}
      <div className="flex min-w-0 flex-1 flex-col justify-between">
        {meta}
        <div className="mt-2 flex flex-wrap gap-1.5" onClick={stopCardAction} onKeyDown={stopCardAction}>
          {typeof onEdit === 'function' ? (
            <button
              type="button"
              onClick={(event) => {
                stopCardAction(event);
                openEditor();
              }}
              disabled={!interactive}
              className="inline-flex h-8 items-center rounded-lg border border-gray-200 px-2.5 text-[11px] font-semibold text-gray-800 disabled:opacity-70"
            >
              Edit
            </button>
          ) : null}
          {extraActions}
          <button
            type="button"
            onClick={(event) => {
              stopCardAction(event);
              openPicker();
            }}
            disabled={!interactive}
            className="inline-flex h-8 items-center rounded-lg border border-primary-100 bg-primary-50/60 px-2.5 text-[11px] font-semibold text-primary-800 disabled:opacity-70"
          >
            Replace
          </button>
          <button
            type="button"
            onClick={(event) => {
              stopCardAction(event);
              onRemove?.();
            }}
            disabled={!interactive}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-100 text-red-600 disabled:opacity-50"
            aria-label={`Remove ${label}`}
          >
            <FiX size={14} />
          </button>
        </div>
        {instructions ? <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-gray-500">{instructions}</p> : null}
      </div>
    </article>
  );
}
