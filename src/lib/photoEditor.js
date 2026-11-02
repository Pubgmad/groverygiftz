export function getFrameSize(area, orientation = 'auto') {
  const rawWidth = Math.max(1, Number(area?.width || 1));
  const rawHeight = Math.max(1, Number(area?.height || 1));
  const width = orientation === 'portrait' ? Math.min(rawWidth, rawHeight) : orientation === 'landscape' ? Math.max(rawWidth, rawHeight) : rawWidth;
  const height = orientation === 'portrait' ? Math.max(rawWidth, rawHeight) : orientation === 'landscape' ? Math.min(rawWidth, rawHeight) : rawHeight;
  return { width, height };
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
  const normalized = String(unit || '').toLowerCase();
  if (!['in', 'inch', 'inches'].includes(normalized)) return null;
  const w = Number(printWidth);
  const h = Number(printHeight);
  if (!(w > 0) || !(h > 0) || !(imageWidth > 0) || !(imageHeight > 0)) return null;
  const rotated = Math.abs(Number(rotation) || 0) % 180 === 90;
  const imgW = rotated ? imageHeight : imageWidth;
  const imgH = rotated ? imageWidth : imageHeight;
  const fitInchesPerPixel = Math.min(w / imgW, h / imgH);
  const ppi = 1 / (fitInchesPerPixel * Math.max(0.1, Number(zoom) || 1));
  if (!Number.isFinite(ppi) || ppi <= 0) return null;
  return Math.round(ppi);
}

export function qualityLabel(ppi) {
  if (!(ppi > 0)) return '';
  if (ppi >= 200) return 'Best';
  if (ppi >= 150) return 'Good';
  if (ppi >= 100) return 'Fair';
  return 'Low';
}

export function formatFrameSubtitle(area, orientation, extraLabel = '') {
  const { width, height } = getFrameSize(area, orientation);
  const unit = area?.unit || 'inch';
  const size = `${width}×${height} ${unit === 'ratio' ? '' : unit}`.trim();
  return [size, extraLabel].filter(Boolean).join(' · ');
}
