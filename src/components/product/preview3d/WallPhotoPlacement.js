'use client';

import { useEffect, useRef, useState } from 'react';
import { FiImage, FiX } from 'react-icons/fi';

/**
 * Original GroveryGiftz wall-photo placement — not live camera AR.
 * Uses the same approved crop texture shown in 3D. Scale is illustrative unless
 * the customer later calibrates against a known object (A4 is not enabled here).
 */
export default function WallPhotoPlacement({
  frameTextureUrl = '',
  dimensionLabel = '',
  onClose,
}) {
  const [wallUrl, setWallUrl] = useState('');
  const [scale, setScale] = useState(0.28);
  const [pos, setPos] = useState({ x: 50, y: 36 });
  const dragRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => () => {
    if (wallUrl) {
      try { URL.revokeObjectURL(wallUrl); } catch { /* ignore */ }
    }
  }, [wallUrl]);

  const onFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    if (wallUrl) {
      try { URL.revokeObjectURL(wallUrl); } catch { /* ignore */ }
    }
    setWallUrl(URL.createObjectURL(file));
  };

  const onPointerDown = (event) => {
    if (!wallUrl) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY, pos };
  };

  const onPointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag) return;
    const parent = event.currentTarget.getBoundingClientRect();
    const dx = ((event.clientX - drag.x) / Math.max(1, parent.width)) * 100;
    const dy = ((event.clientY - drag.y) / Math.max(1, parent.height)) * 100;
    setPos({
      x: Math.max(8, Math.min(92, drag.pos.x + dx)),
      y: Math.max(8, Math.min(92, drag.pos.y + dy)),
    });
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-[#1a1714]/95">
      <div className="flex items-center justify-between gap-2 px-3 py-2 text-white">
        <p className="min-w-0 truncate text-[11px] font-semibold">
          Place on your wall photo · illustrative, not camera AR
        </p>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg bg-white/10"
          aria-label="Close wall photo placement"
        >
          <FiX size={18} />
        </button>
      </div>
      <div
        className="relative min-h-0 flex-1 touch-none overflow-hidden bg-black"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {wallUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={wallUrl} alt="Your wall" className="h-full w-full object-cover" draggable={false} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-white">
            <FiImage size={28} />
            <p className="text-sm font-semibold">Add a photo of your wall</p>
            <p className="text-[11px] text-white/70">
              This is not live camera tracking. Size on screen is illustrative.
              {dimensionLabel ? ` ${dimensionLabel}.` : ''}
            </p>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="min-h-[44px] rounded-xl bg-white px-4 text-sm font-bold text-gray-900"
            >
              Choose wall photo
            </button>
          </div>
        )}
        {wallUrl && frameTextureUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={frameTextureUrl}
            alt="Your framed photo"
            draggable={false}
            className="pointer-events-none absolute rounded-[2px] border-[6px] border-[#2a2118] object-cover shadow-2xl"
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              width: `${Math.round(scale * 100)}%`,
              transform: 'translate(-50%, -50%)',
              aspectRatio: 'auto',
            }}
          />
        ) : null}
      </div>
      <div className="space-y-2 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-white">
        <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={onFile} />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="min-h-[44px] flex-1 rounded-xl bg-white/10 px-3 text-xs font-semibold"
          >
            {wallUrl ? 'Replace wall photo' : 'Choose wall photo'}
          </button>
        </div>
        {wallUrl ? (
          <label className="block text-[11px]">
            Frame size on this photo (illustrative)
            <input
              type="range"
              min="0.12"
              max="0.7"
              step="0.01"
              value={scale}
              onChange={(event) => setScale(Number(event.target.value))}
              className="mt-1 w-full accent-primary-400"
            />
          </label>
        ) : null}
      </div>
    </div>
  );
}
