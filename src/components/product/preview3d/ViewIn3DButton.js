'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { FiBox, FiHome, FiSmartphone } from 'react-icons/fi';
import { isPreview3dEligible, resolvePreview3dForSelection, resolvePreview3dSurfaces } from '@/lib/preview3d';
import { warmupCropAccurateViewerTextures } from '@/lib/preview3dCropTexture';

const Product3DViewerModal = dynamic(() => import('./Product3DViewerModal'), {
  ssr: false,
  loading: () => null,
});

/**
 * Optional CTAs. Modal stays mounted after first open so WebGL can warm-reopen.
 * GLB preload is deferred to hover/focus — not on every PDP mount.
 */
export default function ViewIn3DButton({
  product,
  customerPhotos = [],
  variantLabelUploads = {},
  previewAdjustments = {},
  previewAreas = [],
  customizationPreviewPayload = null,
  selectedVariants = {},
  allowCameraAr = false,
}) {
  const [open, setOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false);
  const [initialPresentationMode, setInitialPresentationMode] = useState('inspect');
  const preloadStartedRef = useRef(false);
  const config = useMemo(
    () => resolvePreview3dForSelection(product, selectedVariants),
    [product, selectedVariants],
  );

  const warmPreviewAssets = () => {
    if (typeof window !== 'undefined' && !window.__preview3dPreloadStartedAt) {
      window.__preview3dPreloadStartedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    }
    warmupCropAccurateViewerTextures({
      product,
      preview3d: config,
      customerPhotos,
      variantLabelUploads,
      selectedVariants,
      previewAdjustments,
      previewAreas,
      surfaces: resolvePreview3dSurfaces(product, config),
    }).catch(() => { /* bake retries when the viewer opens */ });
    if (preloadStartedRef.current) return;
    preloadStartedRef.current = true;
    Promise.all([import('./Product3DViewerModal'), import('./Preview3dScene')])
      .then(([, sceneMod]) => {
        try { if (config?.modelUrl) sceneMod.preloadPreview3dModel?.(config.modelUrl); } catch { /* ignore */ }
      })
      .catch(() => {
        preloadStartedRef.current = false;
      });
  };

  const customerEligible = isPreview3dEligible(product);

  useEffect(() => {
    if (!customerEligible || typeof window === 'undefined') return undefined;
    const prefetch = () => {
      import('./Product3DViewerModal');
      import('./Preview3dScene');
    };
    const idle = window.setTimeout(prefetch, 0);
    return () => window.clearTimeout(idle);
  }, [customerEligible]);

  if (!customerEligible) return null;

  const openMode = (mode) => {
    warmPreviewAssets();
    setInitialPresentationMode(mode);
    setEverOpened(true);
    setOpen(true);
  };

  const instantUrl = customerPhotos.find((photo) => photo?.url)?.url || product?.images?.[0] || '';

  return (
    <>
      {open ? (
        <div className="fixed inset-0 z-[79] flex items-stretch justify-center bg-black/55 sm:items-center sm:p-4" aria-hidden>
          <div className="flex h-[100dvh] w-full max-w-5xl flex-col overflow-hidden bg-[#f4f0e8] shadow-2xl sm:h-[min(92dvh,880px)] sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-black/5 px-4 py-3">
              <p className="text-sm font-bold text-gray-900">{initialPresentationMode === 'wall' ? 'On Wall' : 'View in 3D'}</p>
              <button type="button" onClick={() => setOpen(false)} className="min-h-[44px] min-w-[44px] rounded-xl border bg-white" aria-label="Close 3D viewer">×</button>
            </div>
            <div className="relative min-h-0 flex-1 bg-[#f4f0e8]">
              {instantUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={instantUrl} alt="" className="h-full w-full object-contain p-6" />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <div className="h-9 w-9 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
      <div
        className="flex min-w-0 w-full max-w-full flex-col gap-2 sm:w-auto sm:max-w-none sm:flex-row sm:flex-wrap"
        onPointerEnter={warmPreviewAssets}
        onFocusCapture={warmPreviewAssets}
      >
        <button
          type="button"
          data-preview3d-cta="inspect"
          onClick={() => openMode('inspect')}
          className="inline-flex min-h-[44px] w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-primary-200 bg-white px-4 py-2.5 text-sm font-bold text-primary-800 shadow-sm transition hover:bg-primary-50 sm:w-auto"
        >
          <FiBox size={16} aria-hidden />
          View in 3D
        </button>
        <button
          type="button"
          data-preview3d-cta="wall"
          onClick={() => openMode('wall')}
          className="inline-flex min-h-[44px] w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-bold text-emerald-900 shadow-sm transition hover:bg-emerald-50 sm:w-auto"
        >
          <FiHome size={16} aria-hidden />
          View on Wall
        </button>
        {allowCameraAr ? (
          <button
            type="button"
            data-preview3d-cta="ar"
            onClick={() => openMode('ar')}
            className="inline-flex min-h-[44px] w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-sky-200 bg-white px-4 py-2.5 text-sm font-bold text-sky-900 shadow-sm transition hover:bg-sky-50 sm:w-auto"
          >
            <FiSmartphone size={16} aria-hidden />
            Place in room
          </button>
        ) : null}
      </div>
      {everOpened ? (
        <Product3DViewerModal
          open={open}
          onClose={() => setOpen(false)}
          product={product}
          customerPhotos={customerPhotos}
          variantLabelUploads={variantLabelUploads}
          previewAdjustments={previewAdjustments}
          previewAreas={previewAreas}
          customizationPreviewPayload={customizationPreviewPayload}
          selectedVariants={selectedVariants}
          initialPresentationMode={initialPresentationMode}
          allowCameraAr={allowCameraAr}
        />
      ) : null}
    </>
  );
}
