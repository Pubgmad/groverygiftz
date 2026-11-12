'use client';

import { useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { FiBox, FiHome, FiSmartphone } from 'react-icons/fi';
import { isPreview3dAdminCandidate, isPreview3dEligible, resolvePreview3dForSelection, resolvePreview3dSurfaces } from '@/lib/preview3d';
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
  previewAdjustments = {},
  previewAreas = [],
  customizationPreviewPayload = null,
  selectedVariants = {},
  allowAdminPreview = false,
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
      previewAdjustments,
      previewAreas,
      surfaces: resolvePreview3dSurfaces(product, config),
    }).catch(() => { /* bake retries when the viewer opens */ });
    if (preloadStartedRef.current) return;
    preloadStartedRef.current = true;
    import('./Preview3dScene')
      .then((mod) => {
        try { if (config?.modelUrl) mod.preloadPreview3dModel?.(config.modelUrl); } catch { /* ignore */ }
      })
      .catch(() => {
        preloadStartedRef.current = false;
      });
  };

  const customerEligible = isPreview3dEligible(product);
  const adminEligible = allowAdminPreview && isPreview3dAdminCandidate(product);
  if (!customerEligible && !adminEligible) return null;

  const openMode = (mode) => {
    warmPreviewAssets();
    setInitialPresentationMode(mode);
    setEverOpened(true);
    setOpen(true);
  };

  return (
    <>
      <div
        className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row"
        onPointerEnter={warmPreviewAssets}
        onFocusCapture={warmPreviewAssets}
      >
        <button
          type="button"
          data-preview3d-cta="inspect"
          onClick={() => openMode('inspect')}
          className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-primary-200 bg-white px-4 py-2.5 text-sm font-bold text-primary-800 shadow-sm transition hover:bg-primary-50 sm:w-auto"
        >
          <FiBox size={16} aria-hidden />
          View in 3D
        </button>
        <button
          type="button"
          data-preview3d-cta="wall"
          onClick={() => openMode('wall')}
          className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-bold text-emerald-900 shadow-sm transition hover:bg-emerald-50 sm:w-auto"
        >
          <FiHome size={16} aria-hidden />
          View on Wall
        </button>
        {allowCameraAr ? (
          <button
            type="button"
            data-preview3d-cta="ar"
            onClick={() => openMode('ar')}
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-sky-200 bg-white px-4 py-2.5 text-sm font-bold text-sky-900 shadow-sm transition hover:bg-sky-50 sm:w-auto"
          >
            <FiSmartphone size={16} aria-hidden />
            Place in room
          </button>
        ) : null}
      </div>
      {adminEligible ? (
        <p className="text-[11px] font-semibold text-amber-800">Admin 3D preview — not visible to customers</p>
      ) : null}
      {everOpened ? (
        <Product3DViewerModal
          open={open}
          onClose={() => setOpen(false)}
          product={product}
          customerPhotos={customerPhotos}
          previewAdjustments={previewAdjustments}
          previewAreas={previewAreas}
          customizationPreviewPayload={customizationPreviewPayload}
          selectedVariants={selectedVariants}
          initialPresentationMode={initialPresentationMode}
          allowAdminPreview={adminEligible}
          allowCameraAr={allowCameraAr}
        />
      ) : null}
    </>
  );
}
