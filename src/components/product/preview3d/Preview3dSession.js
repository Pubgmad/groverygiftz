'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { isPreview3dEligible } from '@/lib/preview3d';

const Product3DViewerModal = dynamic(() => import('./Product3DViewerModal'), {
  ssr: false,
  loading: () => null,
});

const Preview3dSessionContext = createContext(null);

/**
 * One WebGL host for the product page. Per-photo buttons only open this session.
 */
export function Preview3dSessionProvider({
  children,
  product,
  customerPhotos = [],
  variantLabelUploads = {},
  previewAdjustments = {},
  previewAreas = [],
  selectedVariants = {},
  collageTextures = null,
}) {
  const eligible = isPreview3dEligible(product);
  const [open, setOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false);
  const [focus, setFocus] = useState({
    slotKey: '',
    kind: 'slot',
    mode: 'inspect',
    collageTextures: null,
  });

  const openViewer = useCallback((next = {}) => {
    if (typeof window !== 'undefined') {
      window.__preview3dOpenAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
      window.__preview3dTimings = { openAt: window.__preview3dOpenAt, clickToFirstVisualMs: 0 };
    }
    setFocus({
      slotKey: String(next.slotKey || ''),
      kind: next.kind || 'slot',
      mode: next.mode === 'wall' ? 'wall' : 'inspect',
      collageTextures: Array.isArray(next.collageTextures) ? next.collageTextures : null,
    });
    setEverOpened(true);
    setOpen(true);
  }, []);

  const value = useMemo(() => ({ eligible, openViewer }), [eligible, openViewer]);

  return (
    <Preview3dSessionContext.Provider value={value}>
      {children}
      {eligible && everOpened ? (
        <Product3DViewerModal
          open={open}
          onClose={() => setOpen(false)}
          product={product}
          customerPhotos={customerPhotos}
          variantLabelUploads={variantLabelUploads}
          previewAdjustments={previewAdjustments}
          previewAreas={previewAreas}
          selectedVariants={selectedVariants}
          focusSlotKey={focus.slotKey}
          focusKind={focus.kind}
          collageTextures={focus.collageTextures || collageTextures}
          initialPresentationMode={focus.mode}
        />
      ) : null}
    </Preview3dSessionContext.Provider>
  );
}

export function usePreview3dSession() {
  return useContext(Preview3dSessionContext);
}
