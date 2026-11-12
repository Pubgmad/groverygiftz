'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiLoader, FiRefreshCw, FiRotateCcw, FiRotateCw, FiX } from 'react-icons/fi';
import { estimatePrintPpi, fitFrameInBox, formatFrameSubtitle, getContainScale, getFillZoom, getFrameSize, photoLookCssFilter, qualityGuidance } from '@/lib/photoEditor';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export default function PhotoAdjuster({
  open,
  label,
  extraLabel = '',
  area,
  photoUrl,
  blobUrl = '',
  fallbackUrl = '',
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
  const [boxPx, setBoxPx] = useState({ width: 0, height: 0 });
  const [imageReady, setImageReady] = useState(false);
  const [imageError, setImageError] = useState('');
  const [activeSrc, setActiveSrc] = useState(photoUrl || '');
  const dragRef = useRef(null);
  const pointersRef = useRef(new Map());
  const pinchRef = useRef(null);
  const frameRef = useRef(null);
  const stageRef = useRef(null);
  const fileRef = useRef(null);
  const draftRef = useRef(draft);
  const baselineRef = useRef(baseline);
  const closeRef = useRef(onClose);
  const savingRef = useRef(saving);
  const triedFallbackRef = useRef(false);
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
    setActiveSrc(photoUrl || '');
    triedFallbackRef.current = false;
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

  // When the photo is replaced while the editor stays open, reset from latest baseline.
  useEffect(() => {
    if (!open || !photoUrl) return;
    const next = baselineRef.current;
    setDraft(next);
    setOpenedBaseline(next);
    setImageReady(false);
    setImageError('');
    setImageSize({ width: 0, height: 0 });
    setActiveSrc(photoUrl);
    triedFallbackRef.current = false;
  }, [open, photoUrl]);

  // Background original upload must not blank a working local preview (Genie-style editing).
  useEffect(() => {
    if (replacing) setImageError('');
  }, [replacing]);

  // Observe the stage box (parent), not the frame — then size the frame with an exact aspect ratio.
  useEffect(() => {
    const node = stageRef.current;
    if (!open || !node) return undefined;
    const update = () => {
      const rect = node.getBoundingClientRect();
      // getBoundingClientRect returns border-box (content + padding).
      // Subtract computed padding so boxPx matches the CSS content-box that
      // maxWidth/maxHeight:'100%' resolves against — otherwise framePx can be
      // up to padding-px taller than the content area, maxHeight clips the
      // rendered height while leaving the width unchanged, corrupting the ratio.
      const cs = getComputedStyle(node);
      const padH = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
      const padV = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
      setBoxPx({ width: Math.max(0, rect.width - padH), height: Math.max(0, rect.height - padV) });
    };
    update();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(update) : null;
    observer?.observe(node);
    window.addEventListener('resize', update);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [open, draft.orientation]);

  const frame = getFrameSize(area, draft.orientation);
  const framePx = useMemo(
    () => fitFrameInBox(frame.width, frame.height, boxPx.width, boxPx.height),
    [frame.width, frame.height, boxPx.width, boxPx.height]
  );
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
  // `replacing` only blocks UI when the image is not yet usable (no local blob decode yet).
  const awaitingPhoto = replacing && !imageReady;
  const loadBusy = saving || awaitingPhoto || (!imageReady && !imageError);
  const replaceBusy = saving || replacing;
  const editBusy = saving || awaitingPhoto || !imageReady || Boolean(imageError);

  useEffect(() => {
    if (!open || draft.fitMode !== 'fill' || !(fillZoom > 0) || !(imageSize.width > 0)) return;
    if (Math.abs(Number(draft.zoom || 1) - fillZoom) < 0.02) return;
    setDraft((prev) => (prev.fitMode === 'fill' ? { ...prev, zoom: fillZoom } : prev));
  }, [open, fillZoom, draft.fitMode, draft.zoom, imageSize.width]);

  useEffect(() => {
    const node = frameRef.current;
    if (!open || !node || !imageReady) return undefined;
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
    if (editBusy) return;
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

  const handleImageError = () => {
    const candidates = [blobUrl, fallbackUrl, photoUrl]
      .map((value) => String(value || '').trim())
      .filter(Boolean)
      .filter((value, index, list) => list.indexOf(value) === index)
      .filter((value) => value !== activeSrc);

    if (!triedFallbackRef.current && candidates.length > 0) {
      triedFallbackRef.current = true;
      setImageReady(false);
      setImageError('');
      setActiveSrc(candidates[0]);
      return;
    }

    // Allow a second alternate candidate before giving up (blob <-> signed).
    if (triedFallbackRef.current === true && candidates.length > 1) {
      triedFallbackRef.current = 'done';
      setImageReady(false);
      setImageError('');
      setActiveSrc(candidates[1]);
      return;
    }

    setImageReady(false);
    setImageError('This photo could not be loaded. Please choose another image.');
  };

  const statusText = awaitingPhoto
    ? 'Preparing your photo…'
    : replacing && imageReady
      ? 'Saving original in background…'
      : imageError
        ? 'Photo failed to load'
        : imageReady
          ? `${imageSize.width} × ${imageSize.height} px`
          : 'Preparing your photo…';

  if (!open || typeof document === 'undefined') return null;

  const showLoading = awaitingPhoto || (!imageReady && !imageError);
  // Ignore collapsed stage measurements (md:h-auto / first paint) so landscape never snaps to a tiny wrong box.
  const frameReady = framePx.width >= 48 && framePx.height >= 48;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-white text-gray-950 md:items-center md:justify-center md:bg-gray-950/50 md:p-4" style={{ height: '100dvh', paddingTop: 'env(safe-area-inset-top)' }} role="dialog" aria-modal="true" aria-labelledby="photo-adjuster-title">
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-white md:h-[min(92dvh,760px)] md:max-h-[95dvh] md:max-w-lg md:rounded-3xl md:shadow-xl">
        <header className="grid shrink-0 grid-cols-[44px_1fr_auto] items-center gap-2 border-b border-gray-100 px-3 py-2.5">
          <button type="button" onClick={onClose} disabled={saving} className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-gray-800" aria-label="Close photo editor">
            <FiX size={20} />
          </button>
          <div className="min-w-0 text-center">
            <h2 id="photo-adjuster-title" className="truncate font-display text-base font-bold">Edit Photo</h2>
            <p className="truncate text-xs text-gray-500">{sizeSubtitle || label}</p>
          </div>
          <button type="button" onClick={() => setDraft(openedBaseline)} disabled={editBusy} className="inline-flex min-h-11 items-center gap-1 rounded-full bg-gray-100 px-3 text-sm font-semibold text-gray-800 disabled:opacity-60">
            <FiRefreshCw size={14} /> Reset
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
        <div ref={stageRef} className="flex min-h-[200px] flex-1 items-center justify-center bg-gray-100 px-4 py-3">
          <div
            ref={frameRef}
            className="relative overflow-hidden border-4 border-gray-900 bg-white shadow-sm"
            style={{
              width: frameReady ? `${framePx.width}px` : 'auto',
              height: frameReady ? `${framePx.height}px` : '100%',
              // Keep aspect-ratio even after frameReady so the frame never collapses to square
              // while ResizeObserver is firing asynchronously on iOS Safari.
              aspectRatio: `${frame.width} / ${frame.height}`,
              // Fallback only: when we have not yet measured the stage, constrain width to the
              // content area so the portrait aspect-ratio extends vertically (not horizontally).
              // Using height:100% + maxWidth rather than width:100% + maxHeight is critical:
              // the old pattern let browsers that pre-date transferred-constraint support
              // (Chrome<88 / Safari<15) render the frame as stageContentW × stageContentH ≈ square.
              // With height:100%, width is derived from the ratio and never exceeds maxWidth.
              maxWidth: frameReady ? undefined : '100%',
              touchAction: 'none',
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {showLoading ? (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white px-3 text-center">
                <FiLoader className="animate-spin text-primary-600" size={28} />
                <p className="mt-2 text-sm font-semibold text-gray-700">Preparing your photo…</p>
              </div>
            ) : null}
            {imageError && !awaitingPhoto ? (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-white p-4 text-center">
                <p className="text-sm text-red-600">{imageError}</p>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={replaceBusy}
                  className="min-h-10 rounded-xl border border-primary-200 px-4 text-sm font-semibold text-primary-800 disabled:opacity-60"
                >
                  Choose Another Photo
                </button>
              </div>
            ) : null}
            {!imageError ? (
              <div className="absolute inset-0 overflow-hidden bg-white">
                <img
                  key={activeSrc}
                  src={activeSrc}
                  alt=""
                  draggable={false}
                  onLoad={(event) => {
                    setImageSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight });
                    setImageReady(true);
                    setImageError('');
                  }}
                  onError={handleImageError}
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
                    filter: photoLookCssFilter(draft),
                    visibility: imageReady ? 'visible' : 'hidden',
                  }}
                />
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-2 border-t border-gray-100 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              {ppi && imageReady && !imageError ? (
                <p className="text-sm font-bold">
                  <span className={ppi >= 150 ? 'text-emerald-700' : ppi >= 100 ? 'text-amber-700' : 'text-red-600'}>{guidance.label}</span>
                  <span className="ml-2 text-gray-600">{ppi} PPI</span>
                </p>
              ) : (
                <p className={`text-xs ${imageError ? 'font-semibold text-red-600' : 'text-gray-500'}`}>{statusText}</p>
              )}
            </div>
            <button type="button" onClick={() => fileRef.current?.click()} disabled={replaceBusy} className="min-h-10 shrink-0 rounded-xl border border-primary-200 px-3 text-sm font-semibold text-primary-800 disabled:cursor-not-allowed disabled:opacity-60">
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
                disabled={editBusy}
                onClick={() => setOrientation(value)}
                className={`min-h-10 rounded-xl px-2 text-xs font-semibold disabled:opacity-60 ${draft.orientation === value ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700'}`}
              >
                {text}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-4 gap-2">
            <button type="button" disabled={editBusy} onClick={() => rotateBy(-90)} className="flex min-h-10 items-center justify-center rounded-xl bg-gray-100 text-gray-800 disabled:opacity-60" aria-label="Rotate left"><FiRotateCcw size={18} /></button>
            <button type="button" disabled={editBusy} onClick={() => rotateBy(90)} className="flex min-h-10 items-center justify-center rounded-xl bg-gray-100 text-gray-800 disabled:opacity-60" aria-label="Rotate right"><FiRotateCw size={18} /></button>
            <button type="button" disabled={editBusy} onClick={applyFit} className={`flex min-h-10 items-center justify-center rounded-xl text-sm font-semibold disabled:opacity-60 ${draft.fitMode === 'fit' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-800'}`}>Fit</button>
            <button type="button" disabled={editBusy} onClick={applyFill} className={`flex min-h-10 items-center justify-center rounded-xl text-sm font-semibold disabled:opacity-60 ${draft.fitMode === 'fill' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-800'}`}>Fill</button>
          </div>
        </div>

        <div className="border-t border-gray-100 px-4 pt-2">
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-semibold text-gray-800">Zoom</span>
            <span className="text-gray-500">{Number(draft.zoom || 1).toFixed(2)}x</span>
          </div>
          <input type="range" min="1" max={maxZoom} step="0.05" value={draft.zoom || 1} disabled={editBusy} onChange={(event) => updateDraft({ zoom: Number(event.target.value), fitMode: 'custom' })} className="w-full accent-primary-600 disabled:opacity-60" />
        </div>
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-gray-100 bg-white px-4 pt-3" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
          <button type="button" disabled={saving} onClick={onClose} className="flex min-h-12 items-center justify-center rounded-2xl border border-gray-200 text-sm font-bold text-gray-800">
            Cancel
          </button>
          <button
            type="button"
            disabled={editBusy || loadBusy}
            onClick={() => onApply?.(draft)}
            className="flex min-h-12 items-center justify-center rounded-2xl bg-accent-500 text-sm font-bold text-white disabled:opacity-60"
          >
            {saving ? 'Applying…' : 'Apply Changes'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
