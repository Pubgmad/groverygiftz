/**
 * Read-only crop-accurate textures for the optional 3D viewer.
 * Mirrors ProductDetail.renderFinalPreviewImage math WITHOUT frame overlays,
 * so the 3D model frame is not doubled. Does not upload, mutate, or persist images.
 */

import { beginCanvasPhotoLook, endCanvasPhotoLook, getFrameSize } from '@/lib/photoEditor';
import { previewLoadUrls } from '@/lib/clientImageUpload';
import {
  listCustomizationSlotDescriptors,
  normalizePreview3dConfig,
  pickDurableImageUrl,
  pickLiveImageUrl,
  resolveMappedSurfaceId,
} from '@/lib/preview3d';

const DEFAULT_ADJUSTMENTS = Object.freeze({
  zoom: 1,
  x: 0,
  y: 0,
  orientation: 'auto',
  rotation: 0,
  fitMode: 'fit',
  brightness: 100,
  contrast: 100,
  saturation: 100,
});

const warmupStore = {
  key: '',
  promise: null,
  result: null,
};

function cropBakeKey({ product, customerPhotos = [], previewAdjustments = {}, previewAreas = [], surfaces = [] } = {}) {
  const photoKeys = (customerPhotos || []).map((photo) => (
    pickLiveImageUrl(photo) || pickDurableImageUrl(photo) || photo?.previewUrl || ''
  ));
  return JSON.stringify({
    productId: product?._id || product?.id || product?.slug || '',
    photoKeys,
    previewAdjustments,
    areas: (previewAreas || []).map((area) => ({
      w: area?.width,
      h: area?.height,
      u: area?.unit,
    })),
    surfaces: (surfaces || []).map((s) => s?.id || s?.meshName || ''),
  });
}

function releaseWarmupIfStale(nextKey) {
  if (warmupStore.key && warmupStore.key !== nextKey && warmupStore.result) {
    try { warmupStore.result.revokeAll?.(); } catch { /* ignore */ }
    warmupStore.result = null;
    warmupStore.promise = null;
  }
}

function getContainedDrawRect(sourceWidth, sourceHeight, boxWidth, boxHeight) {
  const scale = Math.min(
    boxWidth / Math.max(1, sourceWidth),
    boxHeight / Math.max(1, sourceHeight),
  );
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return {
    x: (boxWidth - width) / 2,
    y: (boxHeight - height) / 2,
    width,
    height,
  };
}

function getPreviewDimensions(area, orientation) {
  const { width, height } = getFrameSize(area, orientation);
  const displayWidth = 720;
  return {
    displayWidth,
    displayHeight: displayWidth * (height / Math.max(0.01, width)),
  };
}

function loadImage(url, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    if (!url) {
      reject(new Error('Missing image URL'));
      return;
    }
    const image = new Image();
    image.crossOrigin = 'anonymous';
    const timer = setTimeout(() => reject(new Error('Image load timed out')), timeoutMs);
    image.onload = () => {
      clearTimeout(timer);
      resolve(image);
    };
    image.onerror = () => {
      clearTimeout(timer);
      reject(new Error('Unable to load image for 3D texture'));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas, quality = 0.92) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Unable to encode 3D texture'))),
      'image/jpeg',
      quality,
    );
  });
}

/**
 * Render the customer's applied crop/zoom/pan/rotation into a temporary JPEG blob URL.
 * Deliberately omits decorative frameImage overlays.
 */
export async function renderCropOnlyTextureBlobUrl({
  photo,
  area = null,
  adjustments = null,
} = {}) {
  const candidates = previewLoadUrls(photo);
  if (!candidates.length) {
    const durable = pickDurableImageUrl(photo) || pickLiveImageUrl(photo);
    if (durable) candidates.push(durable);
  }
  if (!candidates.length) {
    return { url: '', source: 'empty', parity: 'missing_photo', revoke: null };
  }

  const adj = { ...DEFAULT_ADJUSTMENTS, ...(adjustments || {}) };
  const { displayWidth, displayHeight } = getPreviewDimensions(
    area || { width: 1, height: 1 },
    adj.orientation,
  );
  // Match ProductDetail.renderFinalPreviewImage retina scale so x/y pan stays aligned.
  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(320, Math.round(displayWidth * scale));
  canvas.height = Math.max(240, Math.round(displayHeight * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { url: '', source: 'empty', parity: 'canvas_unavailable', revoke: null };
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let uploadedImage = null;
  let lastError = null;
  for (const candidate of candidates) {
    try {
      uploadedImage = await loadImage(candidate);
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
    }
  }
  if (!uploadedImage) {
    return {
      url: '',
      source: 'empty',
      parity: 'load_failed',
      error: lastError?.message || 'load_failed',
      revoke: null,
    };
  }

  const srcW = uploadedImage.naturalWidth || uploadedImage.width;
  const srcH = uploadedImage.naturalHeight || uploadedImage.height;
  const rotation = ((Number(adj.rotation || 0) % 360) + 360) % 360;
  const rad = (rotation * Math.PI) / 180;
  const boundW = Math.abs(Math.cos(rad)) * srcW + Math.abs(Math.sin(rad)) * srcH;
  const boundH = Math.abs(Math.sin(rad)) * srcW + Math.abs(Math.cos(rad)) * srcH;
  const imageRect = getContainedDrawRect(boundW, boundH, canvas.width, canvas.height);
  const zoom = Math.max(0.1, Number(adj.zoom || 1));
  const scaleToBound = (imageRect.width * zoom) / Math.max(1, boundW);
  const drawW = srcW * scaleToBound;
  const drawH = srcH * scaleToBound;
  const centerX = canvas.width / 2 + Number(adj.x || 0) * scale;
  const centerY = canvas.height / 2 + Number(adj.y || 0) * scale;

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(rad);
  beginCanvasPhotoLook(ctx, adj);
  ctx.drawImage(uploadedImage, -drawW / 2, -drawH / 2, drawW, drawH);
  endCanvasPhotoLook(ctx);
  ctx.restore();
  // Intentionally skip area.frameImage — 3D geometry supplies the frame.

  const blob = await canvasToBlob(canvas, 0.92);
  const url = URL.createObjectURL(blob);
  return {
    url,
    source: 'crop_accurate',
    parity: 'matched',
    revoke: () => {
      try { URL.revokeObjectURL(url); } catch { /* ignore */ }
    },
  };
}

async function buildCropAccurateViewerTexturesUncached({
  product,
  preview3d,
  customerPhotos = [],
  previewAdjustments = {},
  previewAreas = [],
  surfaces = [],
} = {}) {
  const slots = listCustomizationSlotDescriptors(product);
  const config = normalizePreview3dConfig(preview3d || {});
  const mappingBySlot = Object.fromEntries(
    (config.surfaceMappings || []).map((row) => [row.slotKey, row.surfaceId]),
  );
  const surfaceById = Object.fromEntries((surfaces || []).map((s) => [s.id, s]));
  const revokers = [];

  const textures = [];
  for (let index = 0; index < slots.length; index += 1) {
    const slot = slots[index];
    const photo = customerPhotos[index] || null;
    const area = previewAreas[index]
      || product?.customizationPreview?.areas?.[index]
      || {
        label: slot.areaLabel,
        width: slot.width || 1,
        height: slot.height || 1,
        unit: slot.unit || 'inch',
      };
    const adjustments = {
      ...DEFAULT_ADJUSTMENTS,
      ...(previewAdjustments?.[slot.index] || previewAdjustments?.[index] || {}),
    };
    const surfaceId = resolveMappedSurfaceId(slot, mappingBySlot, surfaces, index);
    const surface = surfaceById[surfaceId] || surfaces[index] || null;

    if (!photo) {
      textures.push({
        ...slot,
        surfaceId,
        meshName: surface?.meshName || '',
        meshPath: surface?.meshPath || '',
        materialName: surface?.materialName || '',
        textureUrl: '',
        textureSource: 'empty',
        parity: 'placeholder',
        isPlaceholder: true,
        placeholderUrl: config.placeholderUrl || '',
        aspect: {
          width: Number(area.width) || 1,
          height: Number(area.height) || 1,
        },
      });
      continue;
    }

    try {
      const rendered = await renderCropOnlyTextureBlobUrl({ photo, area, adjustments });
      if (rendered.revoke) revokers.push(rendered.revoke);
      textures.push({
        ...slot,
        surfaceId,
        meshName: surface?.meshName || '',
        meshPath: surface?.meshPath || '',
        materialName: surface?.materialName || '',
        textureUrl: rendered.url,
        textureSource: rendered.source,
        parity: rendered.parity,
        isPlaceholder: !rendered.url,
        placeholderUrl: config.placeholderUrl || '',
        aspect: {
          width: Number(area.width) || 1,
          height: Number(area.height) || 1,
        },
        warning: rendered.parity !== 'matched' && rendered.parity !== 'placeholder'
          ? `3D texture parity limited (${rendered.parity})`
          : '',
      });
    } catch (error) {
      textures.push({
        ...slot,
        surfaceId,
        meshName: surface?.meshName || '',
        meshPath: surface?.meshPath || '',
        materialName: surface?.materialName || '',
        textureUrl: pickDurableImageUrl(photo) || pickLiveImageUrl(photo) || '',
        textureSource: 'fallback_uncropped',
        parity: 'fallback_uncropped',
        isPlaceholder: false,
        placeholderUrl: config.placeholderUrl || '',
        warning: 'Could not bake crop-accurate texture; showing source photo without guaranteed crop parity.',
        aspect: {
          width: Number(area.width) || 1,
          height: Number(area.height) || 1,
        },
      });
    }
  }

  return {
    textures,
    fromCache: false,
    revokeAll: () => {
      revokers.forEach((fn) => {
        try { fn(); } catch { /* ignore */ }
      });
    },
  };
}

/**
 * Start crop baking before the viewer mounts. Does not change approved crop data.
 */
export function warmupCropAccurateViewerTextures(args = {}) {
  if (typeof window === 'undefined') return Promise.resolve(null);
  const key = cropBakeKey(args);
  releaseWarmupIfStale(key);
  if (warmupStore.key === key && warmupStore.result) {
    return Promise.resolve({ ...warmupStore.result, fromCache: true });
  }
  if (warmupStore.key === key && warmupStore.promise) return warmupStore.promise;
  warmupStore.key = key;
  warmupStore.promise = buildCropAccurateViewerTexturesUncached(args)
    .then((result) => {
      warmupStore.result = result;
      warmupStore.promise = null;
      return { ...result, fromCache: true };
    })
    .catch((error) => {
      warmupStore.promise = null;
      throw error;
    });
  return warmupStore.promise;
}

/**
 * Build N texture slots with crop-accurate session URLs when photos exist.
 * Reuses a hover-warmup bake when the approved crop has not changed.
 */
export async function buildCropAccurateViewerTextures(args = {}) {
  const key = cropBakeKey(args);
  releaseWarmupIfStale(key);
  if (warmupStore.key === key && warmupStore.result) {
    return { ...warmupStore.result, fromCache: true };
  }
  if (warmupStore.key === key && warmupStore.promise) {
    return warmupStore.promise;
  }
  return warmupCropAccurateViewerTextures(args);
}

/** Tiny labeled sample textures for admin configuration (no customer data). */
export function createAdminSampleTextureDataUrl(label = 'SAMPLE', hue = 28) {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const gradient = ctx.createLinearGradient(0, 0, 512, 512);
  gradient.addColorStop(0, `hsl(${hue} 42% 78%)`);
  gradient.addColorStop(1, `hsl(${hue + 24} 35% 62%)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 512);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillRect(48, 180, 416, 150);
  ctx.fillStyle = '#3a2f24';
  ctx.font = 'bold 42px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(String(label || 'SAMPLE').slice(0, 18), 256, 250);
  ctx.font = '24px system-ui, sans-serif';
  ctx.fillText('Admin sample · not a customer photo', 256, 290);
  return canvas.toDataURL('image/jpeg', 0.85);
}
