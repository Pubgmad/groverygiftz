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

export function adjustmentsForUploadedPhoto(imageWidth, imageHeight) {
  return {
    zoom: 1,
    x: 0,
    y: 0,
    orientation: detectPhotoOrientation(imageWidth, imageHeight),
    rotation: 0,
    fitMode: 'fit',
  };
}

export function getFillZoom(imageWidth, imageHeight, frameWidth, frameHeight, rotation = 0) {
  const rotated = Math.abs(Number(rotation) || 0) % 180 === 90;
  const imgW = Math.max(1, rotated ? Number(imageHeight) || 1 : Number(imageWidth) || 1);
  const imgH = Math.max(1, rotated ? Number(imageWidth) || 1 : Number(imageHeight) || 1);
  const frameW = Math.max(1, Number(frameWidth) || 1);
  const frameH = Math.max(1, Number(frameHeight) || 1);
  const contain = Math.min(frameW / imgW, frameH / imgH);
  const cover = Math.max(frameW / imgW, frameH / imgH);
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
