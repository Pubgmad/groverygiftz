'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiLoader, FiRefreshCw, FiRotateCcw, FiRotateCw, FiX } from 'react-icons/fi';
import { estimatePrintPpi, formatFrameSubtitle, getContainScale, getFillZoom, getFrameSize, qualityGuidance } from '@/lib/photoEditor';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export default function PhotoAdjuster({
  open,
  label,
  extraLabel = '',
  area,
  photoUrl,
  baseline,
  saving = false,
  replacing = false,
  onClose,
  onApply,
  onReplace,
}) {
  const [draft, setDraft] = useState(baseline);
  const [openedBaseline, setOpenedBaseline] = useState(baseline);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [framePx, setFramePx] = useState({ width: 0, height: 0 });
  const [imageReady, setImageReady] = useState(false);
  const [imageError, setImageError] = useState('');
  const dragRef = useRef(null);
  const pointersRef = useRef(new Map());
  const pinchRef = useRef(null);
  const frameRef = useRef(null);
  const fileRef = useRef(null);
  const draftRef = useRef(draft);
  const baselineRef = useRef(baseline);
  const closeRef = useRef(onClose);
  const savingRef = useRef(saving);
  closeRef.current = onClose;
  savingRef.current = saving;
  baselineRef.current = baseline;

  useEffect(() => { draftRef.current = draft; }, [draft]);

  useEffect(() => {
    if (!open) return undefined;
    setDraft(baseline);
    setOpenedBaseline(baseline);
    setImageReady(false);
    setImageError('');
    setImageSize({ width: 0, height: 0 });
    document.body.classList.add('photo-editor-open');
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event) => { if (event.key === 'Escape' && !savingRef.current) closeRef.current?.(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('photo-editor-open');
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // When the photo is replaced while the editor stays open, reset draft from the
  // latest baseline (ProductDetail updates adjustments before/with the new URL).
  useEffect(() => {
    if (!open || !photoUrl) return;
    const next = baselineRef.current;
    setDraft(next);
    setOpenedBaseline(next);
    setImageReady(false);
    setImageError('');
    setImageSize({ width: 0, height: 0 });
  }, [open, photoUrl]);

  useEffect(() => {
    const node = frameRef.current;
    if (!open || !node) return undefined;
    const update = () => {
      const rect = node.getBoundingClientRect();
      setFramePx({ width: rect.width, height: rect.height });
    };
    update();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(update) : null;
    observer?.observe(node);
    window.addEventListener('resize', update);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [open, imageReady, draft.orientation]);

  const frame = getFrameSize(area, draft.orientation);
  const fillZoom = useMemo(
    () => getFillZoom(imageSize.width, imageSize.height, frame.width, frame.height, draft.rotation),
    [imageSize.width, imageSize.height, frame.width, frame.height, draft.rotation]
  );
  const containScale = useMemo(
    () => getContainScale(imageSize.width, imageSize.height, framePx.width, framePx.height, draft.rotation),
    [imageSize.width, imageSize.height, framePx.width, framePx.height, draft.rotation]
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
  const displayScale = containScale * Math.max(0.1, Number(draft.zoom || 1));
  const busy = saving || replacing || !imageReady;

  useEffect(() => {
    if (!open || draft.fitMode !== 'fill' || !(fillZoom > 0) || !(imageSize.width > 0)) return;
    if (Math.abs(Number(draft.zoom || 1) - fillZoom) < 0.02) return;
    setDraft((prev) => (prev.fitMode === 'fill' ? { ...prev, zoom: fillZoom } : prev));
  }, [open, fillZoom, draft.fitMode, draft.zoom, imageSize.width]);

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
    if (busy) return;
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
    <div className="fixed inset-0 z-[90] flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-white text-gray-950 md:bg-gray-950/50 md:p-4 md:items-center md:justify-center" style={{ height: '100dvh', paddingTop: 'env(safe-area-inset-top)' }} role="dialog" aria-modal="true" aria-labelledby="photo-adjuster-title">
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-white md:h-auto md:max-h-[95dvh] md:max-w-lg md:rounded-3xl md:shadow-xl">
        <header className="grid shrink-0 grid-cols-[44px_1fr_auto] items-center gap-2 border-b border-gray-100 px-3 py-2.5">
          <button type="button" onClick={onClose} disabled={saving} className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-gray-800" aria-label="Close photo editor">
            <FiX size={20} />
          </button>
          <div className="min-w-0 text-center">
            <h2 id="photo-adjuster-title" className="truncate font-display text-base font-bold">Edit Photo</h2>
            <p className="truncate text-xs text-gray-500">{sizeSubtitle || label}</p>
          </div>
          <button type="button" onClick={() => setDraft(openedBaseline)} disabled={busy} className="inline-flex min-h-11 items-center gap-1 rounded-full bg-gray-100 px-3 text-sm font-semibold text-gray-800">
            <FiRefreshCw size={14} /> Reset
          </button>
        </header>

        <div className="flex min-h-0 flex-1 items-center justify-center bg-gray-100 px-4 py-3">
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
            {(!imageReady && !imageError) || replacing ? (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/90 px-3 text-center">
                <FiLoader className="animate-spin text-primary-600" size={28} />
                <p className="mt-2 text-sm font-semibold text-gray-700">{replacing ? 'Preparing your photo…' : 'Loading photo…'}</p>
              </div>
            ) : null}
            {imageError ? (
              <p className="absolute inset-0 flex items-center justify-center bg-white p-4 text-center text-sm text-red-600">{imageError}</p>
            ) : (
              <div className="absolute inset-0 overflow-hidden bg-white">
                <img
                  key={photoUrl}
                  src={photoUrl}
                  alt=""
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
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    width: imageSize.width || 'auto',
                    height: imageSize.height || 'auto',
                    maxWidth: 'none',
                    maxHeight: 'none',
                    transform: `translate(-50%, -50%) translate(${draft.x}px, ${draft.y}px) rotate(${draft.rotation || 0}deg) scale(${displayScale || 1})`,
                    transformOrigin: 'center',
                    visibility: imageReady ? 'visible' : 'hidden',
                  }}
                />
              </div>
            )}
          </div>
        </div>

        <div className="min-h-0 max-h-[42%] shrink-0 space-y-2 overflow-y-auto border-t border-gray-100 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              {ppi ? (
                <p className="text-sm font-bold">
                  <span className={ppi >= 150 ? 'text-emerald-700' : ppi >= 100 ? 'text-amber-700' : 'text-red-600'}>{guidance.label}</span>
                  <span className="ml-2 text-gray-600">{ppi} PPI</span>
                </p>
              ) : (
                <p className="text-xs text-gray-500">{replacing ? 'Preparing your photo…' : imageReady ? `${imageSize.width} × ${imageSize.height} px` : 'Loading photo…'}</p>
              )}
            </div>
            <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="min-h-10 shrink-0 rounded-xl border border-primary-200 px-3 text-sm font-semibold text-primary-800">
              {replacing ? 'Updating…' : 'Change Photo'}
            </button>
            <input ref={fileRef} type="file" accept="image/*,.heic,.heif" className="sr-only" onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) onReplace?.(file);
            }} />
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[['auto', 'Configured'], ['portrait', 'Portrait'], ['landscape', 'Landscape']].map(([value, text]) => (
              <button
                key={value}
                type="button"
                disabled={busy}
                onClick={() => setOrientation(value)}
                className={`min-h-10 rounded-xl px-2 text-xs font-semibold ${draft.orientation === value ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700'}`}
              >
                {text}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-4 gap-2">
            <button type="button" disabled={busy} onClick={() => rotateBy(-90)} className="flex min-h-10 items-center justify-center rounded-xl bg-gray-100 text-gray-800" aria-label="Rotate left"><FiRotateCcw size={18} /></button>
            <button type="button" disabled={busy} onClick={() => rotateBy(90)} className="flex min-h-10 items-center justify-center rounded-xl bg-gray-100 text-gray-800" aria-label="Rotate right"><FiRotateCw size={18} /></button>
            <button type="button" disabled={busy} onClick={applyFit} className={`flex min-h-10 items-center justify-center rounded-xl text-sm font-semibold ${draft.fitMode === 'fit' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-800'}`}>Fit</button>
            <button type="button" disabled={busy} onClick={applyFill} className={`flex min-h-10 items-center justify-center rounded-xl text-sm font-semibold ${draft.fitMode === 'fill' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-800'}`}>Fill</button>
          </div>

        </div>

        <div className="shrink-0 border-t border-gray-100 px-4 pt-2">
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-semibold text-gray-800">Zoom</span>
            <span className="text-gray-500">{Number(draft.zoom || 1).toFixed(2)}x</span>
          </div>
          <input type="range" min="1" max={maxZoom} step="0.05" value={draft.zoom || 1} disabled={busy} onChange={(event) => updateDraft({ zoom: Number(event.target.value), fitMode: 'custom' })} className="w-full accent-primary-600" />
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-gray-100 bg-white px-4 pt-3" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
          <button type="button" disabled={saving} onClick={onClose} className="flex min-h-12 items-center justify-center rounded-2xl border border-gray-200 text-sm font-bold text-gray-800">
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onApply?.(draft)}
            className="flex min-h-12 items-center justify-center rounded-2xl bg-accent-500 text-sm font-bold text-white disabled:opacity-60"
          >
            {saving ? 'Saving…' : replacing ? 'Updating…' : 'Apply Changes'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
