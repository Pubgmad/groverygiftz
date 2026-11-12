export function detectPhotoOrientation(imageWidth, imageHeight, rotation = 0) {
  const rotated = Math.abs(Number(rotation) || 0) % 180 === 90;
  const width = Number(rotated ? imageHeight : imageWidth) || 0;
  const height = Number(rotated ? imageWidth : imageHeight) || 0;
  if (!(width > 0) || !(height > 0) || width === height) return 'auto';
  return width > height ? 'landscape' : 'portrait';
}

export function getFrameSize(area, orientation = 'auto') {
  const rawWidth = Math.max(1, Number(area?.width || 1));
  const rawHeight = Math.max(1, Number(area?.height || 1));
  const width = orientation === 'portrait' ? Math.min(rawWidth, rawHeight) : orientation === 'landscape' ? Math.max(rawWidth, rawHeight) : rawWidth;
  const height = orientation === 'portrait' ? Math.max(rawWidth, rawHeight) : orientation === 'landscape' ? Math.min(rawWidth, rawHeight) : rawHeight;
  return { width, height };
}

/**
 * Fit a frame aspect ratio inside a CSS pixel box without distorting it.
 * Prevents height:100% + max-width clamping from collapsing landscape frames toward square.
 */
export function fitFrameInBox(frameWidth, frameHeight, boxWidth, boxHeight) {
  const ratioW = Math.max(0.01, Number(frameWidth) || 1);
  const ratioH = Math.max(0.01, Number(frameHeight) || 1);
  const boxW = Math.max(0, Number(boxWidth) || 0);
  const boxH = Math.max(0, Number(boxHeight) || 0);
  if (!(boxW > 0) || !(boxH > 0)) return { width: 0, height: 0 };
  const scale = Math.min(boxW / ratioW, boxH / ratioH);
  return {
    width: Math.max(1, ratioW * scale),
    height: Math.max(1, ratioH * scale),
  };
}

export function adjustmentsForUploadedPhoto(imageWidth, imageHeight, area = null, rotation = 0) {
  let orientation = detectPhotoOrientation(imageWidth, imageHeight, rotation);
  // Only fall back to area aspect when image dimensions are unavailable (decode failure).
  if ((!(Number(imageWidth) > 0) || !(Number(imageHeight) > 0))
    && area
    && Number(area.width) > 0
    && Number(area.height) > 0
    && Number(area.width) !== Number(area.height)) {
    orientation = Number(area.width) > Number(area.height) ? 'landscape' : 'portrait';
  }
  const frame = area ? getFrameSize(area, orientation) : null;
  const zoom = frame && Number(imageWidth) > 0 && Number(imageHeight) > 0
    ? getFillZoom(imageWidth, imageHeight, frame.width, frame.height, rotation)
    : 1;
  return {
    zoom,
    x: 0,
    y: 0,
    orientation,
    rotation: Number(rotation) || 0,
    fitMode: 'fill',
  };
}

export function getOrientedImageSize(imageWidth, imageHeight, rotation = 0) {
  const rotated = Math.abs(Number(rotation) || 0) % 180 === 90;
  return {
    width: Math.max(1, rotated ? Number(imageHeight) || 1 : Number(imageWidth) || 1),
    height: Math.max(1, rotated ? Number(imageWidth) || 1 : Number(imageHeight) || 1),
  };
}

export function getContainScale(imageWidth, imageHeight, frameWidth, frameHeight, rotation = 0) {
  const image = getOrientedImageSize(imageWidth, imageHeight, rotation);
  const frameW = Math.max(1, Number(frameWidth) || 1);
  const frameH = Math.max(1, Number(frameHeight) || 1);
  return Math.min(frameW / image.width, frameH / image.height);
}

export function getFillZoom(imageWidth, imageHeight, frameWidth, frameHeight, rotation = 0) {
  const image = getOrientedImageSize(imageWidth, imageHeight, rotation);
  const frameW = Math.max(1, Number(frameWidth) || 1);
  const frameH = Math.max(1, Number(frameHeight) || 1);
  const contain = Math.min(frameW / image.width, frameH / image.height);
  const cover = Math.max(frameW / image.width, frameH / image.height);
  if (!(contain > 0)) return 1;
  return Math.max(1, cover / contain);
}

export function estimatePrintPpi({ imageWidth, imageHeight, printWidth, printHeight, unit, zoom = 1, rotation = 0 }) {
  // Fit (zoom 1): PPI of the contained photo on the actual print size.
  // Fill/crop: zoom is cover/contain, so PPI falls as fewer source pixels cover the print.
  const normalized = String(unit || '').toLowerCase();
  if (!['in', 'inch', 'inches'].includes(normalized)) return null;
  const printW = Number(printWidth);
  const printH = Number(printHeight);
  if (!(printW > 0) || !(printH > 0) || !(imageWidth > 0) || !(imageHeight > 0)) return null;
  const rotated = Math.abs(Number(rotation) || 0) % 180 === 90;
  const imgW = rotated ? Number(imageHeight) : Number(imageWidth);
  const imgH = rotated ? Number(imageWidth) : Number(imageHeight);
  const containInchesPerPixel = Math.min(printW / imgW, printH / imgH);
  if (!(containInchesPerPixel > 0)) return null;
  const ppi = 1 / (containInchesPerPixel * Math.max(0.1, Number(zoom) || 1));
  if (!Number.isFinite(ppi) || ppi <= 0) return null;
  return Math.round(ppi);
}

export function qualityGuidance(ppi) {
  if (!(ppi > 0)) return { label: '', detail: '' };
  if (ppi >= 300) return { label: 'Excellent', detail: '300+ PPI is photo-lab quality for this frame.' };
  if (ppi >= 200) return { label: 'High', detail: '200–299 PPI prints clearly at this frame size.' };
  if (ppi >= 150) return { label: 'Good', detail: '150–199 PPI is acceptable for most photo prints.' };
  if (ppi >= 100) return { label: 'Fair', detail: '100–149 PPI may look slightly soft in the print.' };
  return { label: 'Low', detail: 'Below 100 PPI may look pixelated in the print.' };
}

export function qualityLabel(ppi) {
  return qualityGuidance(ppi).label;
}

export function formatFrameSizeLabel(area, orientation) {
  if (!area || (!(Number(area.width) > 0) && !(Number(area.height) > 0))) return '';
  const { width, height } = getFrameSize(area, orientation);
  const unit = area?.unit || 'inch';
  return `${width} × ${height}${unit === 'ratio' ? '' : ` ${unit}`}`;
}

export function formatFrameSubtitle(area, orientation, extraLabel = '') {
  return [formatFrameSizeLabel(area, orientation), extraLabel].filter(Boolean).join(' · ');
}

export function orientationCaption(orientation) {
  if (orientation === 'landscape') return 'Landscape';
  if (orientation === 'portrait') return 'Portrait';
  return 'Configured';
}
