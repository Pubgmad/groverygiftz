'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiLoader, FiRefreshCw, FiRotateCcw, FiRotateCw, FiX } from 'react-icons/fi';
import { estimatePrintPpi, formatFrameSubtitle, getFillZoom, getFrameSize, qualityGuidance } from '@/lib/photoEditor';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export default function PhotoAdjuster({
  open,
  label,
  extraLabel = '',
  area,
  photoUrl,
  baseline,
  saving = false,
  onClose,
  onApply,
  onReplace,
}) {
  const [draft, setDraft] = useState(baseline);
  const [openedBaseline, setOpenedBaseline] = useState(baseline);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [imageReady, setImageReady] = useState(false);
  const [imageError, setImageError] = useState('');
  const dragRef = useRef(null);
  const pointersRef = useRef(new Map());
  const pinchRef = useRef(null);
  const frameRef = useRef(null);
  const fileRef = useRef(null);
  const draftRef = useRef(draft);
  const closeRef = useRef(onClose);
  const savingRef = useRef(saving);
  closeRef.current = onClose;
  savingRef.current = saving;

  useEffect(() => { draftRef.current = draft; }, [draft]);

  useEffect(() => {
    if (!open) return undefined;
    setDraft(baseline);
    setOpenedBaseline(baseline);
    setImageReady(false);
    setImageError('');
    setImageSize({ width: 0, height: 0 });
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event) => { if (event.key === 'Escape' && !savingRef.current) closeRef.current?.(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, photoUrl]);

  useEffect(() => {
    const node = frameRef.current;
    if (!open || !node) return undefined;
    const handleWheel = (event) => {
      event.preventDefault();
      const current = draftRef.current;
      const next = clamp(Number(current.zoom || 1) + (event.deltaY < 0 ? 0.05 : -0.05), 1, 8);
      setDraft((prev) => ({ ...prev, zoom: Number(next.toFixed(2)), fitMode: 'custom' }));
    };
    node.addEventListener('wheel', handleWheel, { passive: false });
    return () => node.removeEventListener('wheel', handleWheel);
  }, [open, imageReady]);

  const frame = getFrameSize(area, draft.orientation);
  const fillZoom = useMemo(
    () => getFillZoom(imageSize.width, imageSize.height, frame.width, frame.height, draft.rotation),
    [imageSize.width, imageSize.height, frame.width, frame.height, draft.rotation]
  );
  const maxZoom = Math.max(3, Number((fillZoom * 2).toFixed(2)));
  const ppi = estimatePrintPpi({
    imageWidth: imageSize.width,
    imageHeight: imageSize.height,
    printWidth: frame.width,
    printHeight: frame.height,
    unit: area?.unit,
    zoom: draft.zoom,
    rotation: draft.rotation,
  });
  const guidance = qualityGuidance(ppi);
  const sizeSubtitle = formatFrameSubtitle(area, draft.orientation, extraLabel);

  const updateDraft = (updates) => {
    setDraft((prev) => ({ ...prev, ...updates }));
  };

  const applyFit = () => updateDraft({ zoom: 1, x: 0, y: 0, fitMode: 'fit' });
  const applyFill = () => updateDraft({ zoom: fillZoom, x: 0, y: 0, fitMode: 'fill' });
  const rotateBy = (amount) => {
    const rotation = ((Number(draft.rotation || 0) + amount) % 360 + 360) % 360;
    const nextFill = getFillZoom(imageSize.width, imageSize.height, frame.width, frame.height, rotation);
    updateDraft({
      rotation,
      ...(draft.fitMode === 'fill' ? { zoom: nextFill, x: 0, y: 0 } : {}),
    });
  };
  const setOrientation = (orientation) => {
    const nextFrame = getFrameSize(area, orientation);
    const nextFill = getFillZoom(imageSize.width, imageSize.height, nextFrame.width, nextFrame.height, draft.rotation);
    updateDraft({
      orientation,
      ...(draft.fitMode === 'fill' ? { zoom: nextFill, x: 0, y: 0 } : {}),
    });
  };

  const onPointerDown = (event) => {
    if (saving || !imageReady) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointersRef.current.size === 1) {
      dragRef.current = { startX: event.clientX, startY: event.clientY, x: draft.x, y: draft.y };
    } else if (pointersRef.current.size === 2) {
      const points = [...pointersRef.current.values()];
      const dx = points[0].x - points[1].x;
      const dy = points[0].y - points[1].y;
      pinchRef.current = { distance: Math.hypot(dx, dy), zoom: draftRef.current.zoom };
      dragRef.current = null;
    }
  };

  const onPointerMove = (event) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointersRef.current.size === 2 && pinchRef.current) {
      const points = [...pointersRef.current.values()];
      const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      if (pinchRef.current.distance > 0) {
        const nextZoom = clamp(pinchRef.current.zoom * (distance / pinchRef.current.distance), 1, maxZoom);
        updateDraft({ zoom: Number(nextZoom.toFixed(2)), fitMode: 'custom' });
      }
      return;
    }
    const drag = dragRef.current;
    if (!drag) return;
    updateDraft({
      x: clamp(drag.x + event.clientX - drag.startX, -160, 160),
      y: clamp(drag.y + event.clientY - drag.startY, -160, 160),
      fitMode: 'custom',
    });
  };

  const onPointerUp = (event) => {
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (pointersRef.current.size === 0) dragRef.current = null;
  };

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex flex-col bg-gray-950/50 md:items-center md:justify-center md:p-4" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }} role="dialog" aria-modal="true" aria-labelledby="photo-adjuster-title">
      <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-white text-gray-950 shadow-xl md:h-auto md:max-h-[95dvh] md:w-full md:max-w-lg md:flex-none md:rounded-3xl">
        <header className="grid shrink-0 grid-cols-[44px_1fr_auto] items-center gap-2 border-b border-gray-100 px-3 py-3">
          <button type="button" onClick={onClose} disabled={saving} className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-gray-800" aria-label="Close photo editor">
            <FiX size={20} />
          </button>
          <div className="min-w-0 text-center">
            <h2 id="photo-adjuster-title" className="truncate font-display text-base font-bold">Edit Photo</h2>
            <p className="truncate text-xs text-gray-500">{sizeSubtitle || label}</p>
          </div>
          <button type="button" onClick={() => setDraft(openedBaseline)} disabled={saving} className="inline-flex min-h-11 items-center gap-1 rounded-full bg-gray-100 px-3 text-sm font-semibold text-gray-800">
            <FiRefreshCw size={14} /> Reset
          </button>
        </header>

        <div className="flex min-h-[42dvh] flex-1 items-center justify-center bg-gray-100 px-4 py-4">
          <div
            ref={frameRef}
            className="relative max-h-full max-w-full overflow-hidden border-4 border-gray-900 bg-white shadow-sm"
            style={{
              aspectRatio: `${frame.width} / ${frame.height}`,
              height: '100%',
              width: 'auto',
              touchAction: 'none',
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {!imageReady && !imageError ? (
              <div className="absolute inset-0 flex items-center justify-center bg-white">
                <FiLoader className="animate-spin text-primary-600" size={28} />
              </div>
            ) : null}
            {imageError ? (
              <p className="absolute inset-0 flex items-center justify-center bg-white p-4 text-center text-sm text-red-600">{imageError}</p>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-white">
                <img
                  src={photoUrl}
                  alt=""
                  className="max-h-full max-w-full object-contain"
                  draggable={false}
                  onLoad={(event) => {
                    setImageSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight });
                    setImageReady(true);
                    setImageError('');
                  }}
                  onError={() => {
                    setImageReady(false);
                    setImageError('This photo could not be loaded. Please choose another image.');
                  }}
                  style={{
                    transform: `translate(${draft.x}px, ${draft.y}px) rotate(${draft.rotation || 0}deg) scale(${draft.zoom || 1})`,
                    transformOrigin: 'center',
                    visibility: imageReady ? 'visible' : 'hidden',
                  }}
                />
              </div>
            )}
          </div>
        </div>

        <div className="max-h-[48dvh] shrink-0 space-y-3 overflow-y-auto border-t border-gray-100 px-4 pb-4 pt-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {ppi ? (
                <>
                  <p className="text-sm font-bold">
                    <span className={ppi >= 150 ? 'text-emerald-700' : ppi >= 100 ? 'text-amber-700' : 'text-red-600'}>{guidance.label}</span>
                    <span className="ml-2 text-gray-600">{ppi} PPI</span>
                  </p>
                  <p className="mt-0.5 text-[11px] leading-4 text-gray-500">{guidance.detail}</p>
                </>
              ) : imageReady ? (
                <p className="truncate text-xs text-gray-500">{imageSize.width} × {imageSize.height} px</p>
              ) : (
                <p className="text-xs text-gray-400">Loading photo…</p>
              )}
            </div>
            <button type="button" onClick={() => fileRef.current?.click()} disabled={saving} className="min-h-11 shrink-0 rounded-xl border border-primary-200 px-4 text-sm font-semibold text-primary-800">
              Change Photo
            </button>
            <input ref={fileRef} type="file" accept="image/*,.heic,.heif" className="sr-only" onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) onReplace?.(file);
            }} />
          </div>

          <div>
            <p className="mb-1 text-sm font-semibold text-gray-800">Frame direction</p>
            <div className="grid grid-cols-3 gap-2">
              {[['auto', 'Configured'], ['portrait', 'Portrait'], ['landscape', 'Landscape']].map(([value, text]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setOrientation(value)}
                  className={`min-h-11 rounded-2xl px-2 text-xs font-semibold ${draft.orientation === value ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                >
                  {text}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            <button type="button" onClick={() => rotateBy(-90)} className="flex min-h-12 flex-col items-center justify-center rounded-2xl bg-gray-100 text-xs font-semibold text-gray-800" aria-label="Rotate left"><FiRotateCcw size={18} /></button>
            <button type="button" onClick={() => rotateBy(90)} className="flex min-h-12 flex-col items-center justify-center rounded-2xl bg-gray-100 text-xs font-semibold text-gray-800" aria-label="Rotate right"><FiRotateCw size={18} /></button>
            <button type="button" onClick={applyFit} className={`flex min-h-12 items-center justify-center rounded-2xl text-sm font-semibold ${draft.fitMode === 'fit' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-800'}`}>Fit</button>
            <button type="button" onClick={applyFill} className={`flex min-h-12 items-center justify-center rounded-2xl text-sm font-semibold ${draft.fitMode === 'fill' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-800'}`}>Fill</button>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-semibold text-gray-800">Zoom</span>
              <span className="text-gray-500">{Number(draft.zoom || 1).toFixed(2)}x</span>
            </div>
            <input type="range" min="1" max={maxZoom} step="0.05" value={draft.zoom || 1} onChange={(event) => updateDraft({ zoom: Number(event.target.value), fitMode: 'custom' })} className="w-full accent-primary-600" />
            <p className="mt-2 text-center text-[11px] leading-4 text-gray-500">White areas are uncovered print space and may appear in the final print. Drag to move, pinch or scroll to zoom.</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={saving} onClick={onClose} className="flex min-h-12 items-center justify-center rounded-2xl border border-gray-200 text-sm font-bold text-gray-800">
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || !imageReady}
              onClick={() => onApply?.(draft)}
              className="flex min-h-12 items-center justify-center rounded-2xl bg-accent-500 text-sm font-bold text-white disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Apply Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
