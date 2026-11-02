'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiLoader, FiRefreshCw, FiRotateCcw, FiRotateCw, FiX } from 'react-icons/fi';
import { estimatePrintPpi, formatFrameSubtitle, getFillZoom, getFrameSize, qualityLabel } from '@/lib/photoEditor';

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
  const ppiLabel = qualityLabel(ppi);
  const sizeSubtitle = formatFrameSubtitle(area, draft.orientation, extraLabel);

  const updateDraft = (updates) => {
    setDraft((prev) => ({ ...prev, ...updates }));
  };

  const applyFit = () => updateDraft({ zoom: 1, x: 0, y: 0, fitMode: 'fit' });
  const applyFill = () => updateDraft({ zoom: fillZoom, x: 0, y: 0, fitMode: 'fill' });
  const rotateBy = (amount) => updateDraft({ rotation: ((Number(draft.rotation || 0) + amount) % 360 + 360) % 360 });
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
    <div className="fixed inset-0 z-[90] flex flex-col overflow-hidden bg-[#16161c] text-white" style={{ height: '100dvh', paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }} role="dialog" aria-modal="true" aria-labelledby="photo-adjuster-title">
      <header className="grid shrink-0 grid-cols-[44px_1fr_auto] items-center gap-2 px-3 py-3">
        <button type="button" onClick={onClose} disabled={saving} className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10" aria-label="Close photo adjuster">
          <FiX size={20} />
        </button>
        <div className="min-w-0 text-center">
          <h2 id="photo-adjuster-title" className="truncate text-base font-semibold">Adjust photo</h2>
          <p className="truncate text-xs text-white/60">{sizeSubtitle || label}</p>
        </div>
        <button type="button" onClick={() => setDraft(openedBaseline)} disabled={saving} className="inline-flex min-h-11 items-center gap-1 rounded-full bg-white/10 px-3 text-sm font-semibold">
          <FiRefreshCw size={14} /> Reset
        </button>
      </header>

      <div className="flex min-h-[42dvh] flex-1 items-center justify-center px-3 py-2">
        <div
          ref={frameRef}
          className="relative max-h-full max-w-full overflow-hidden rounded-sm"
          style={{
            aspectRatio: `${frame.width} / ${frame.height}`,
            height: '100%',
            width: 'auto',
            touchAction: 'none',
            backgroundImage: 'linear-gradient(45deg, #2b2b33 25%, transparent 25%), linear-gradient(-45deg, #2b2b33 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #2b2b33 75%), linear-gradient(-45deg, transparent 75%, #2b2b33 75%)',
            backgroundSize: '18px 18px',
            backgroundPosition: '0 0, 0 9px, 9px -9px, -9px 0',
            backgroundColor: '#111116',
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {!imageReady && !imageError ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <FiLoader className="animate-spin" size={28} />
            </div>
          ) : null}
          {imageError ? (
            <p className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-red-200">{imageError}</p>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
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
          {area?.frameImage ? <img src={area.frameImage} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-contain" /> : null}
        </div>
      </div>

      <div className="max-h-[48dvh] shrink-0 space-y-3 overflow-y-auto px-4 pb-4 pt-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            {ppi ? (
              <p className="text-sm font-semibold">
                <span className={ppi >= 150 ? 'text-emerald-400' : ppi >= 100 ? 'text-amber-300' : 'text-red-300'}>{ppiLabel}</span>
                <span className="ml-2 text-white/70">{ppi} PPI</span>
              </p>
            ) : imageReady ? (
              <p className="truncate text-xs text-white/60">{imageSize.width} × {imageSize.height} px</p>
            ) : (
              <p className="text-xs text-white/50">Loading photo…</p>
            )}
          </div>
          <button type="button" onClick={() => fileRef.current?.click()} disabled={saving} className="min-h-11 rounded-xl border border-white/25 px-4 text-sm font-semibold">
            Change photo
          </button>
          <input ref={fileRef} type="file" accept="image/*,.heic,.heif" className="sr-only" onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) onReplace?.(file);
          }} />
        </div>

        <div>
          <p className="mb-1 text-sm font-medium">Frame direction</p>
          <div className="grid grid-cols-3 gap-2">
            {[['auto', 'Admin size'], ['portrait', 'Portrait'], ['landscape', 'Landscape']].map(([value, text]) => (
              <button
                key={value}
                type="button"
                onClick={() => setOrientation(value)}
                className={`min-h-11 rounded-2xl px-2 text-xs font-semibold ${draft.orientation === value ? 'bg-white text-gray-950' : 'bg-white/10'}`}
              >
                {text}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <button type="button" onClick={() => rotateBy(-90)} className="flex min-h-12 flex-col items-center justify-center rounded-2xl bg-white/10 text-xs font-semibold" aria-label="Rotate left"><FiRotateCcw size={18} /></button>
          <button type="button" onClick={() => rotateBy(90)} className="flex min-h-12 flex-col items-center justify-center rounded-2xl bg-white/10 text-xs font-semibold" aria-label="Rotate right"><FiRotateCw size={18} /></button>
          <button type="button" onClick={applyFit} className={`flex min-h-12 items-center justify-center rounded-2xl text-sm font-semibold ${draft.fitMode === 'fit' ? 'bg-white text-gray-950' : 'bg-white/10'}`}>Fit</button>
          <button type="button" onClick={applyFill} className={`flex min-h-12 items-center justify-center rounded-2xl text-sm font-semibold ${draft.fitMode === 'fill' ? 'bg-white text-gray-950' : 'bg-white/10'}`}>Fill</button>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-medium">Zoom</span>
            <span className="text-white/60">{Number(draft.zoom || 1).toFixed(2)}x</span>
          </div>
          <input type="range" min="1" max={maxZoom} step="0.05" value={draft.zoom || 1} onChange={(event) => updateDraft({ zoom: Number(event.target.value), fitMode: 'custom' })} className="w-full accent-orange-500" />
          <p className="mt-2 text-center text-[11px] leading-4 text-white/55">Drag to move the photo. Pinch or scroll to zoom. Empty edges stay outside the frame.</p>
        </div>

        <button
          type="button"
          disabled={saving || !imageReady}
          onClick={() => onApply?.(draft)}
          className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-accent-600 text-base font-bold text-white disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save to this frame'}
        </button>
      </div>
    </div>,
    document.body
  );
}
