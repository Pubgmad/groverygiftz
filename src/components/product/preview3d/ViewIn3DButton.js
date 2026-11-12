'use client';

import { useRef } from 'react';
import { FiBox, FiHome } from 'react-icons/fi';
import { usePreview3dSession } from './Preview3dSession';

function prefetchViewer() {
  import('./Product3DViewerModal');
  import('./Preview3dScene');
}

/**
 * Compact per-photo CTA. Opens the shared page-level 3D session — never a second Canvas.
 */
export default function ViewIn3DButton({
  compact = true,
  slotKey = '',
  kind = 'slot',
  collageTextures = null,
  label = 'View in 3D',
  demo = false,
}) {
  const session = usePreview3dSession();
  const prefetched = useRef(false);
  if (!session?.eligible) return null;

  const warm = () => {
    if (prefetched.current) return;
    prefetched.current = true;
    prefetchViewer();
  };

  const open = (mode) => {
    warm();
    session.openViewer({ slotKey, kind: demo ? 'demo' : kind, mode, collageTextures });
  };

  if (demo) {
    return (
      <div
        className="flex min-w-0 w-full max-w-full flex-col gap-2 sm:w-auto sm:flex-row"
        onPointerEnter={warm}
        onFocusCapture={warm}
      >
        <button
          type="button"
          onClick={() => open('inspect')}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-primary-200 bg-white px-4 py-2.5 text-sm font-bold text-primary-800 shadow-sm"
        >
          <FiBox size={16} aria-hidden />
          View in 3D
        </button>
        <button
          type="button"
          onClick={() => open('wall')}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-bold text-emerald-900 shadow-sm"
        >
          <FiHome size={16} aria-hidden />
          View on Wall
        </button>
      </div>
    );
  }

  if (compact) {
    return (
      <button
        type="button"
        data-preview3d-slot={slotKey}
        onPointerEnter={warm}
        onFocus={warm}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          open('inspect');
        }}
        className="inline-flex h-8 items-center gap-1 rounded-lg border border-primary-200 bg-white px-2.5 text-[11px] font-semibold text-primary-800"
      >
        <FiBox size={12} aria-hidden />
        {label}
      </button>
    );
  }

  return (
    <button
      type="button"
      onPointerEnter={warm}
      onClick={() => open('inspect')}
      className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl border border-primary-200 bg-white px-3 text-sm font-semibold text-primary-800"
    >
      <FiBox size={14} aria-hidden />
      {label}
    </button>
  );
}
