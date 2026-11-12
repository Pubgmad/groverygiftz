'use client';

import { Component, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { FiMaximize2, FiRefreshCw, FiX, FiZoomIn, FiHome, FiSmartphone } from 'react-icons/fi';
import {
  buildViewerTextureSlots,
  isPreview3dEligible,
  resolvePreview3dDimensions,
  resolvePreview3dForSelection,
  resolvePreview3dSurfaces,
} from '@/lib/preview3d';
import { buildCropAccurateViewerTextures } from '@/lib/preview3dCropTexture';
import {
  DEFAULT_PHOTO_FRAME_DESIGN_PROFILES,
  DEFAULT_PHOTO_FRAME_HARDWARE_PROFILES,
  formatPhotoFrameDimensionChip,
  resolvePhotoFrameRuntime,
  sizeRulesForProduct,
} from '@/lib/photoFrame3d';
import {
  buildAndroidSceneViewerIntent,
  describeArLimitation,
  detectArCapability,
} from '@/lib/preview3dAr';
import WallPhotoPlacement from './WallPhotoPlacement';

const VIEW_PRESETS = [
  { id: 'angled', label: '3/4' },
  { id: 'front', label: 'Front' },
  { id: 'back', label: 'Back' },
  { id: 'left', label: 'Left' },
  { id: 'right', label: 'Right' },
  { id: 'top', label: 'Top' },
  { id: 'bottom', label: 'Bottom' },
  { id: 'closeup', label: 'Close-up' },
];

const PRESENTATION_MODES = [
  { id: 'inspect', label: '360° view' },
  { id: 'wall', label: 'View on Wall' },
  { id: 'ar', label: 'AR' },
];

const Preview3dScene = dynamic(() => import('./Preview3dScene'), {
  ssr: false,
  loading: () => null,
});

class ModalSceneErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-sm font-semibold text-gray-800">3D preview could not load this model.</p>
          <p className="text-xs text-gray-500">Your product page, photo uploads, and cart still work. Close this viewer to continue.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

const LOAD_STAGES = [
  { id: 'engine', label: 'Loading 3D engine…' },
  { id: 'photos', label: 'Preparing your photos…' },
  { id: 'scene', label: 'Building product view…' },
  { id: 'ready', label: 'Ready' },
];

/**
 * Isolated, read-only 3D viewer shell.
 * Keeps the WebGL canvas mounted after first open so reopen does not rebuild the context.
 */
export default function Product3DViewerModal({
  open,
  onClose,
  product,
  customerPhotos = [],
  variantLabelUploads = {},
  previewAdjustments = {},
  previewAreas = [],
  customizationPreviewPayload = null,
  selectedVariants = {},
  initialPresentationMode = 'inspect',
  allowCameraAr = false,
}) {
  const presentationModes = allowCameraAr
    ? PRESENTATION_MODES
    : PRESENTATION_MODES.filter((mode) => mode.id !== 'ar');
  const startMode = presentationModes.some((m) => m.id === initialPresentationMode)
    ? initialPresentationMode
    : 'inspect';
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [webglError, setWebglError] = useState('');
  const [autoRotate, setAutoRotate] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [viewPreset, setViewPreset] = useState('front');
  const [presentationMode, setPresentationMode] = useState(startMode);
  const [textures, setTextures] = useState([]);
  const [textureBusy, setTextureBusy] = useState(false);
  const [engineReady, setEngineReady] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [parityWarnings, setParityWarnings] = useState([]);
  const [loadStartedAt, setLoadStartedAt] = useState(0);
  const [arNotice, setArNotice] = useState('');
  const [hasMountedScene, setHasMountedScene] = useState(false);
  const [wallPhotoOpen, setWallPhotoOpen] = useState(false);
  const revokeRef = useRef(null);
  const closeBtnRef = useRef(null);
  const sceneReadyRef = useRef(false);
  const engineReadyRef = useRef(false);
  const arCapability = useMemo(() => detectArCapability(), []);
  const handleSceneReady = useCallback(() => setSceneReady(true), []);

  const config = useMemo(
    () => resolvePreview3dForSelection(product, selectedVariants),
    [product, selectedVariants],
  );
  const resolvedDimensions = useMemo(
    () => resolvePreview3dDimensions({
      config,
      product,
      selectedVariantOptions: Object.values(selectedVariants || {}).filter(Boolean),
    }),
    [config, product, selectedVariants],
  );
  const surfaces = useMemo(
    () => resolvePreview3dSurfaces(product, config),
    [product, config],
  );
  const approximateNotice = useMemo(
    () => (surfaces || []).some((surface) => surface?.approximateGeometry === true),
    [surfaces],
  );
  const photoFrameBundle = useMemo(() => (
    resolvePhotoFrameRuntime({
      preview3d: config,
      selectedVariants,
      sizeRules: sizeRulesForProduct(product, product?.photoFrameCatalog?.sizeRules),
      hardwareProfiles: product?.photoFrameCatalog?.hardwareProfiles || DEFAULT_PHOTO_FRAME_HARDWARE_PROFILES,
      designProfiles: product?.photoFrameCatalog?.designProfiles || DEFAULT_PHOTO_FRAME_DESIGN_PROFILES,
    })
  ), [config, product, selectedVariants]);
  // Remount only when variant/model changes — not on wall↔inspect or modal close.
  const selectionKey = `${config.geometryType}|${config.modelUrl}|${config.assetId}|${resolvedDimensions.width}x${resolvedDimensions.height}x${resolvedDimensions.depth}|${resolvedDimensions.modelScale || ''}|${photoFrameBundle.resolved?.openingWidth || ''}x${photoFrameBundle.resolved?.openingHeight || ''}|${photoFrameBundle.resolved?.sizeRuleKey || ''}`;

  const loadStage = !engineReady
    ? 'engine'
    : textureBusy
      ? 'photos'
      : !sceneReady
        ? 'scene'
        : 'ready';
  const stageMeta = LOAD_STAGES.find((s) => s.id === loadStage) || LOAD_STAGES[0];
  const showOverlay = open && loadStage !== 'ready' && !webglError;

  useEffect(() => {
    engineReadyRef.current = engineReady;
  }, [engineReady]);

  useEffect(() => {
    sceneReadyRef.current = sceneReady;
  }, [sceneReady]);

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.dataset.preview3dOpen = '1';
    setWebglError('');
    setFocusedIndex(0);
    setArNotice('');
    const nextMode = presentationModes.some((m) => m.id === initialPresentationMode)
      ? initialPresentationMode
      : 'inspect';
    setPresentationMode(nextMode);
    setViewPreset(nextMode === 'wall' || nextMode === 'ar' ? 'wall' : 'front');
    setWallPhotoOpen(false);
    setHasMountedScene(true);
    setLoadStartedAt(typeof performance !== 'undefined' ? performance.now() : Date.now());
    if (nextMode === 'ar' && allowCameraAr) {
      setArNotice(describeArLimitation(arCapability, buildAndroidSceneViewerIntent({
        modelUrl: config.modelUrl,
        photoBaked: false,
      })));
    }
    setAutoRotate(config.camera?.autoRotate === true);
    if (typeof window !== 'undefined') {
      window.__preview3dOpenAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
      window.__preview3dTimings = { openAt: window.__preview3dOpenAt };
      window.__preview3dReadyMs = null;
    }
    // Warm reopen: keep engine/scene ready flags if WebGL stayed mounted.
    if (!engineReadyRef.current) {
      setEngineReady(false);
      import('./Preview3dScene')
        .then((mod) => {
          if (typeof window !== 'undefined' && typeof performance !== 'undefined') {
            const base = Number(window.__preview3dOpenAt) || performance.now();
            window.__preview3dTimings = window.__preview3dTimings || {};
            window.__preview3dTimings.engineImport = Math.round(performance.now() - base);
          }
          try { mod.preloadPreview3dModel?.(config.modelUrl); } catch { /* ignore */ }
          setEngineReady(true);
        })
        .catch(() => setWebglError('webgl_failed'));
    }
    if (!sceneReadyRef.current) setSceneReady(false);
    closeBtnRef.current?.focus?.();
    return () => {
      document.body.style.overflow = previous;
      delete document.body.dataset.preview3dOpen;
      if (typeof window !== 'undefined' && sceneReadyRef.current) {
        const start = Number(window.__preview3dOpenAt) || 0;
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        window.__preview3dLastVisibleMs = start ? Math.round(now - start) : null;
      }
    };
  }, [open, config.camera?.autoRotate, config.modelUrl, initialPresentationMode]);

  useEffect(() => {
    if (!open) return;
    if (presentationMode === 'wall') {
      setViewPreset('wall');
      setAutoRotate(false);
    } else if (presentationMode === 'inspect' && (viewPreset === 'wall')) {
      setViewPreset('front');
    }
  }, [open, presentationMode]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Bake textures whenever photos/crop change. Do not depend on `open` —
  // keep-alive reopen must reuse decoded textures without a rebuild wait.
  useEffect(() => {
    if (!hasMountedScene) return undefined;
    let cancelled = false;
    setTextureBusy(true);
    const syncFallback = buildViewerTextureSlots({
      product,
      preview3d: config,
      customerPhotos,
      variantLabelUploads,
      selectedVariants,
      customizationPreviewPayload,
    });
    setTextures(syncFallback);

    (async () => {
      const bakeStarted = typeof performance !== 'undefined' ? performance.now() : Date.now();
      try {
        const result = await buildCropAccurateViewerTextures({
          product,
          preview3d: config,
          customerPhotos,
          variantLabelUploads,
          selectedVariants,
          previewAdjustments,
          previewAreas,
          surfaces,
        });
        if (cancelled) {
          result.revokeAll?.();
          return;
        }
        if (!result.fromCache) {
          revokeRef.current?.();
        }
        revokeRef.current = result.fromCache ? null : result.revokeAll;
        setTextures((result.textures || []).map((slot, index) => {
          if (slot?.textureUrl) return slot;
          const fallback = syncFallback[index];
          if (!fallback?.textureUrl) return slot;
          return {
            ...slot,
            textureUrl: fallback.textureUrl,
            textureSource: fallback.textureSource || 'sync_fallback',
            isPlaceholder: false,
            warning: slot.warning || 'Showing source photo while the crop-accurate 3D texture loads.',
          };
        }));
        setParityWarnings(
          result.textures
            .filter((t) => t.warning)
            .map((t) => `${t.areaLabel}: ${t.warning}`),
        );
        if (typeof window !== 'undefined') {
          window.__preview3dTimings = window.__preview3dTimings || {};
          window.__preview3dTimings.textureBakeMs = Math.round(
            (typeof performance !== 'undefined' ? performance.now() : Date.now()) - bakeStarted,
          );
        }
      } catch {
        if (!cancelled) {
          setParityWarnings(['Crop-accurate bake failed; using source photo fallback where available.']);
        }
      } finally {
        if (!cancelled) setTextureBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    hasMountedScene,
    product,
    config,
    customerPhotos,
    variantLabelUploads,
    selectedVariants,
    previewAdjustments,
    previewAreas,
    customizationPreviewPayload,
    surfaces,
  ]);

  useEffect(() => () => {
    revokeRef.current?.();
    revokeRef.current = null;
  }, []);

  useEffect(() => {
    if (!open || !sceneReady) return;
    if (typeof window === 'undefined') return;
    const start = Number(window.__preview3dOpenAt) || 0;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    window.__preview3dReadyMs = start ? Math.round(now - start) : null;
  }, [open, sceneReady]);

  const viewerAllowed = isPreview3dEligible(product);
  if (!viewerAllowed) {
    if (!open) return null;
    return (
      <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
        <div className="w-full max-w-md rounded-t-2xl bg-white p-5 sm:rounded-2xl">
          <p className="text-sm text-gray-700">3D preview is not available for this product configuration.</p>
          <button type="button" onClick={onClose} className="mt-4 min-h-[44px] w-full rounded-xl border px-4 py-2 font-semibold">Close</button>
        </div>
      </div>
    );
  }

  // Keep WebGL alive after first open: hide shell instead of unmounting.
  if (!open && !hasMountedScene) return null;

  const filled = textures.filter((t) => !t.isPlaceholder).length;
  const elapsedMs = loadStartedAt
    ? Math.max(0, Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - loadStartedAt))
    : 0;
  const scenePresentation = presentationMode === 'wall' || presentationMode === 'ar' ? 'wall' : 'inspect';
  const titleByMode = presentationMode === 'wall'
    ? 'View on Wall'
    : presentationMode === 'ar'
      ? 'AR wall placement'
      : 'View in 3D';

  const dimensionChip = formatPhotoFrameDimensionChip(photoFrameBundle.resolved);
  const tryLaunchAr = () => {
    if (!allowCameraAr) return;
    const intent = buildAndroidSceneViewerIntent({
      modelUrl: config.modelUrl,
      title: product?.title || 'Photo frame',
      photoBaked: false,
    });
    setArNotice(describeArLimitation(arCapability, intent.ok ? null : intent));
    setPresentationMode('ar');
    setViewPreset('wall');
    setWallPhotoOpen(true);
  };

  return (
    <div
      className={`fixed inset-0 z-[80] flex items-stretch justify-center overflow-hidden bg-black/55 sm:items-center sm:p-4 ${open ? '' : 'pointer-events-none invisible opacity-0'}`}
      data-preview3d-modal={open ? 'open' : 'closed'}
      data-preview3d-size={photoFrameBundle.resolved?.sizeRuleKey || ''}
      data-preview3d-geometry={photoFrameBundle.effectiveGeometryType || config.geometryType || ''}
      data-preview3d-photo-source={textures[0]?.textureSource || ''}
      data-preview3d-placeholder={textures[0]?.isPlaceholder ? '1' : '0'}
      aria-hidden={open ? undefined : true}
    >
      <div
        className="flex h-[100dvh] w-full max-w-5xl flex-col overflow-hidden bg-[#f4f0e8] shadow-2xl sm:h-[min(92dvh,880px)] sm:rounded-2xl"
        role="dialog"
        aria-modal={open ? 'true' : undefined}
        aria-label={titleByMode}
      >
        <header className="flex items-start justify-between gap-3 border-b border-black/5 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="min-w-0 flex-1 overflow-hidden">
            <p className="truncate text-sm font-bold text-gray-900">{titleByMode}</p>
            <p className="break-words text-[11px] leading-4 text-gray-500">
              {showOverlay ? `${stageMeta.label} · ` : ''}
              {dimensionChip || `${filled}/${textures.length} photo${textures.length === 1 ? '' : 's'} applied`}
              {textures.some((t) => t.isPlaceholder) ? ' · placeholders for empty slots' : ''}
            </p>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border bg-white text-gray-800"
            aria-label="Close 3D viewer"
          >
            <FiX size={20} />
          </button>
        </header>

        {parityWarnings.length ? (
          <div className="border-b border-amber-100 bg-amber-50 px-4 py-2 text-[11px] text-amber-900">
            {parityWarnings[0]}
          </div>
        ) : null}
        {approximateNotice ? (
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-[11px] text-slate-700">
            Some product details (for example rear or hidden faces) are approximate and may not match the physical item exactly.
          </div>
        ) : null}
        {presentationMode === 'wall' ? (
          <div className="border-b border-emerald-100 bg-emerald-50 px-4 py-2 text-[11px] text-emerald-950">
            Illustrative room wall preview using Admin outer proportions. Not live camera AR. Stand hardware is hidden for wall mounting.
            {photoFrameBundle.resolved?.outerDimsVerified ? '' : ' Physical scale is not tape-verified.'}
          </div>
        ) : null}
        {photoFrameBundle.glbCompat && !photoFrameBundle.glbCompat.ok ? (
          <div className="border-b border-amber-100 bg-amber-50 px-4 py-2 text-[11px] text-amber-950">
            {photoFrameBundle.glbCompat.reason}
          </div>
        ) : photoFrameBundle.fidelityNotice && photoFrameBundle.effectiveGeometryType === 'photo_frame' ? (
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-[11px] text-slate-700">
            {photoFrameBundle.fidelityNotice}
          </div>
        ) : null}
        {arNotice ? (
          <div className="border-b border-sky-100 bg-sky-50 px-4 py-2 text-[11px] text-sky-950">{arNotice}</div>
        ) : null}

        <div className="flex gap-1 overflow-x-auto border-b border-black/5 bg-white/70 px-3 py-2">
          {presentationModes.map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => {
                if (mode.id === 'ar') {
                  tryLaunchAr();
                  return;
                }
                setPresentationMode(mode.id);
                setArNotice('');
                setWallPhotoOpen(false);
                // Do not remount WebGL when switching wall ↔ inspect.
              }}
              data-preview3d-mode={mode.id}
              className={`inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold ${presentationMode === mode.id ? 'border-primary-500 bg-primary-50 text-primary-800' : 'bg-white text-gray-700'}`}
            >
              {mode.id === 'wall' ? <FiHome size={13} /> : null}
              {mode.id === 'ar' ? <FiSmartphone size={13} /> : null}
              {mode.label}
            </button>
          ))}
        </div>

        <div className="relative min-h-0 flex-1">
          {webglError ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <p className="text-sm font-semibold text-gray-800">3D viewer could not start on this device.</p>
              <p className="text-xs text-gray-500">Your product page and photo uploads still work normally. You can close this and continue shopping.</p>
              {textures[0]?.textureUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={textures[0].textureUrl} alt="2D fallback preview" className="mt-2 max-h-64 rounded-xl border object-contain" />
              ) : null}
            </div>
          ) : (
            <div
              className="relative h-full w-full"
              onErrorCapture={() => setWebglError('webgl_failed')}
            >
              {(engineReady || hasMountedScene) ? (
                <ModalSceneErrorBoundary key={`boundary-${selectionKey}`}>
                  <Preview3dScene
                    key={`${resetKey}-${selectionKey}-${photoFrameBundle.effectiveGeometryType || config.geometryType}`}
                    active={open}
                    geometryType={photoFrameBundle.effectiveGeometryType || config.geometryType}
                    modelUrl={photoFrameBundle.glbCompat?.ok === false ? '' : config.modelUrl}
                    textures={textures}
                    surfaces={surfaces}
                    layout={config.layout}
                    legacySequentialGlb={config.legacySequentialGlb === true}
                    frameColor={photoFrameBundle.frameColor || config.frameColor}
                    accentColor={photoFrameBundle.accentColor || config.accentColor}
                    environment={scenePresentation === 'wall' ? 'wall' : config.environment}
                    autoRotate={autoRotate}
                    focusedIndex={focusedIndex}
                    camera={config.camera}
                    viewPreset={viewPreset}
                    presentationMode={scenePresentation}
                    dimensions={photoFrameBundle.resolved
                      ? {
                        width: photoFrameBundle.resolved.openingWidth,
                        height: photoFrameBundle.resolved.openingHeight,
                        depth: photoFrameBundle.resolved.depth,
                        unit: photoFrameBundle.resolved.unit,
                        modelScale: resolvedDimensions.modelScale,
                      }
                      : resolvedDimensions}
                    photoFrameResolved={photoFrameBundle.resolved}
                    photoFrameHardware={photoFrameBundle.hardware}
                    photoFrameMaterial={photoFrameBundle.material}
                    photoFrameMoulding={photoFrameBundle.mouldingProfileKey || 'stepped'}
                    attachProceduralHardware={photoFrameBundle.attachProceduralHardware === true}
                    includeProceduralBacking={photoFrameBundle.includeProceduralBacking === true}
                    selectedSurfaceId={textures.length > 1 ? (textures[focusedIndex]?.surfaceId || '') : ''}
                    onSceneReady={handleSceneReady}
                  />
                </ModalSceneErrorBoundary>
              ) : null}
              {wallPhotoOpen ? (
                <WallPhotoPlacement
                  frameTextureUrl={textures.find((t) => t.textureUrl && !t.isPlaceholder)?.textureUrl || ''}
                  dimensionLabel={dimensionChip}
                  onClose={() => setWallPhotoOpen(false)}
                />
              ) : null}
              {showOverlay ? (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#f4f0e8]/80 backdrop-blur-[2px]">
                  <div className="mx-4 max-w-sm rounded-2xl border border-white/70 bg-white/90 px-5 py-4 text-center shadow-lg">
                    <div className="mx-auto mb-3 h-9 w-9 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
                    <p className="text-sm font-bold text-gray-900">{stageMeta.label}</p>
                    <p className="mt-1 text-[11px] text-gray-500">
                      You can close anytime — your customization stays on the product page.
                      {elapsedMs > 2500 ? ` · ${Math.round(elapsedMs / 100) / 10}s` : ''}
                    </p>
                    <div className="mt-3 flex justify-center gap-1.5">
                      {LOAD_STAGES.filter((s) => s.id !== 'ready').map((s) => (
                        <span
                          key={s.id}
                          className={`h-1.5 w-8 rounded-full ${LOAD_STAGES.findIndex((x) => x.id === loadStage) >= LOAD_STAGES.findIndex((x) => x.id === s.id) ? 'bg-primary-500' : 'bg-gray-200'}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="border-t border-black/5 bg-white/90 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
          {textures.length > 1 ? (
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
              {textures.map((slot, index) => (
                <button
                  key={slot.slotKey}
                  type="button"
                  onClick={() => {
                    setFocusedIndex(index);
                    setViewPreset('closeup');
                  }}
                  className={`min-h-[40px] shrink-0 rounded-lg border px-3 text-xs font-semibold ${focusedIndex === index ? 'border-primary-500 bg-primary-50 text-primary-800' : 'bg-white text-gray-700'}`}
                >
                  {slot.areaLabel}{slot.isPlaceholder ? ' · empty' : ''}
                </button>
              ))}
            </div>
          ) : null}
          {scenePresentation === 'inspect' ? (
            <div className="mb-2 flex flex-wrap gap-2 pb-0.5">
              {VIEW_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setViewPreset(preset.id)}
                  data-preview3d-view={preset.id}
                  className={`min-h-[40px] shrink-0 rounded-lg border px-3 text-xs font-semibold ${viewPreset === preset.id ? 'border-primary-500 bg-primary-50 text-primary-800' : 'bg-white text-gray-700'}`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {scenePresentation === 'inspect' ? (
              <button
                type="button"
                onClick={() => setAutoRotate((v) => !v)}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border bg-white px-3 text-xs font-semibold sm:flex-none"
              >
                <FiMaximize2 size={14} /> {autoRotate ? 'Stop spin' : 'Auto-rotate'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setPresentationMode('inspect');
                  setViewPreset('front');
                  setWallPhotoOpen(false);
                }}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border bg-white px-3 text-xs font-semibold sm:flex-none"
              >
                Return to 3D
              </button>
            )}
            <button
              type="button"
              onClick={() => setWallPhotoOpen(true)}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border bg-white px-3 text-xs font-semibold sm:flex-none"
            >
              <FiSmartphone size={14} /> Wall photo
            </button>
            <button
              type="button"
              onClick={() => {
                setResetKey((k) => k + 1);
                setAutoRotate(false);
                setFocusedIndex(0);
                setViewPreset(scenePresentation === 'wall' ? 'wall' : 'front');
                setSceneReady(false);
              }}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border bg-white px-3 text-xs font-semibold sm:flex-none"
            >
              <FiRefreshCw size={14} /> Reset view
            </button>
            <p className="flex min-h-[44px] min-w-0 flex-[1_1_100%] items-center gap-2 overflow-hidden rounded-xl bg-primary-50 px-3 text-[11px] leading-4 text-primary-900 sm:flex-none">
              <FiZoomIn size={14} /> {scenePresentation === 'wall' ? 'Pinch to zoom · wall preview' : 'Drag to rotate · pinch to zoom'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
