'use client';

import { FiLoader, FiUpload, FiX } from 'react-icons/fi';

export default function PhotoUploadCard({
  label,
  sizeLabel = '',
  required = false,
  missingRequired = false,
  photo = null,
  photoUrl = '',
  uploading = false,
  disabled = false,
  accept = 'image/*,.heic,.heif',
  orientation = '',
  onOrientation,
  onUpload,
  onRemove,
  instructions = '',
}) {
  const hasPhoto = Boolean(photoUrl);
  return (
    <article
      aria-invalid={missingRequired || undefined}
      className={`flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-white p-3 ${
        missingRequired ? 'border-red-400 ring-2 ring-red-100' : 'border-gray-200'
      }`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-extrabold text-gray-950">{label}</p>
          {sizeLabel ? <p className="text-[11px] leading-4 text-gray-500">{sizeLabel}</p> : null}
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
          hasPhoto ? 'bg-emerald-50 text-emerald-700' : required ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-600'
        }`}>
          {hasPhoto ? 'Uploaded' : required ? 'Required' : 'Optional'}
        </span>
      </div>
      <div className="relative aspect-square overflow-hidden rounded-xl border border-dashed border-gray-200 bg-gray-50">
        {hasPhoto ? (
          <img src={photoUrl} alt={`${label} upload`} className="h-full w-full object-cover" />
        ) : (
          <label className={`flex h-full w-full cursor-pointer flex-col items-center justify-center gap-1 px-2 text-center ${uploading || disabled ? 'pointer-events-none opacity-70' : ''}`}>
            {uploading ? <FiLoader className="animate-spin text-primary-600" size={22} /> : <FiUpload className="text-primary-600" size={20} />}
            <span className="text-[11px] font-semibold text-gray-800">{uploading ? 'Uploading...' : missingRequired ? 'Photo required' : 'Upload photo'}</span>
            <input
              type="file"
              accept={accept}
              className="sr-only"
              disabled={uploading || disabled}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) onUpload?.(file);
              }}
            />
          </label>
        )}
        {uploading ? (
          <span className="absolute inset-0 flex items-center justify-center bg-white/80">
            <FiLoader className="animate-spin text-primary-600" size={24} />
          </span>
        ) : null}
        {hasPhoto ? (
          <button
            type="button"
            onClick={onRemove}
            disabled={uploading || disabled}
            className="absolute right-1.5 top-1.5 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-red-600 shadow disabled:opacity-50"
            aria-label={`Remove ${label}`}
          >
            <FiX size={16} />
          </button>
        ) : null}
      </div>
      {hasPhoto ? (
        <label className={`mt-2 relative flex min-h-[36px] cursor-pointer items-center justify-center rounded-lg border border-primary-100 bg-primary-50/60 text-xs font-semibold text-primary-800 ${uploading || disabled ? 'pointer-events-none opacity-70' : ''}`}>
          Replace photo
          <input
            type="file"
            accept={accept}
            className="sr-only"
            disabled={uploading || disabled}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) onUpload?.(file);
            }}
          />
        </label>
      ) : null}
      {typeof onOrientation === 'function' ? (
        <div className="mt-2 grid grid-cols-3 gap-1">
          {[['auto', 'Auto'], ['portrait', 'Portrait'], ['landscape', 'Landscape']].map(([value, text]) => (
            <button
              key={value}
              type="button"
              onClick={() => onOrientation(value)}
              className={`min-h-[36px] rounded-lg border px-0.5 text-[9px] font-bold leading-tight ${orientation === value ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600'}`}
            >
              {text}
            </button>
          ))}
        </div>
      ) : null}
      {missingRequired ? <p className="mt-2 text-[11px] font-semibold text-red-600" role="alert">Photo required</p> : null}
      {instructions ? <p className="mt-1 text-[11px] leading-4 text-gray-500">{instructions}</p> : null}
    </article>
  );
}
