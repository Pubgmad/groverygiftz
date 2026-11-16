'use client';

/**
 * Website-identical photo upload + edit for Admin WhatsApp order creation.
 * Reuses customer PhotoUploadCard + PhotoAdjuster with the same area / aspect /
 * orientation / fitMode behavior as ProductDetail.
 */

import { useMemo, useState } from 'react';
import PhotoUploadCard from '@/components/product/PhotoUploadCard';
import PhotoAdjuster from '@/components/product/PhotoAdjuster';
import { prepareImageUpload } from '@/lib/clientImageUpload';
import {
  adjustmentsForUploadedPhoto,
  formatFrameSizeLabel,
  getFrameSize,
  orientationCaption,
} from '@/lib/photoEditor';
import { imagePerfMark, imagePerfMeasure } from '@/lib/imagePerf';

const getDefaultPreviewAdjustments = () => ({ zoom: 1, x: 0, y: 0, orientation: 'auto', rotation: 0, fitMode: 'fit' });

function parseSizeLabel(label = '') {
  const m = String(label || '').match(/(\d+(?:\.\d+)?)\s*[x×*]\s*(\d+(?:\.\d+)?)/i);
  if (!m) return { width: 8, height: 10, unit: 'inch' };
  return { width: Number(m[1]) || 8, height: Number(m[2]) || 10, unit: 'inch' };
}

function canvasToJpegBlob(canvas, quality = 0.92) {
  return new Promise((resolve, reject) => {
    if (typeof canvas.toBlob === 'function') {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Unable to encode preview'))), 'image/jpeg', quality);
      return;
    }
    try {
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      fetch(dataUrl).then((r) => r.blob()).then(resolve).catch(reject);
    } catch (error) {
      reject(error);
    }
  });
}

async function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Unable to load image for editing'));
    img.src = url;
  });
}

/** Bake editor adjustments into a JPEG File (same approach as storefront Apply). */
async function bakeEditedPreview({ photoUrl, area, adjustments }) {
  const img = await loadImage(photoUrl);
  const oriented = getFrameSize(area, adjustments?.orientation);
  const outW = Math.max(400, Math.round((oriented.width || 8) * 90));
  const outH = Math.max(400, Math.round((oriented.height || 10) * 90));
  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, outW, outH);

  const zoom = Math.max(0.5, Number(adjustments?.zoom) || 1);
  const rotation = Number(adjustments?.rotation) || 0;
  const fitMode = adjustments?.fitMode || 'fit';
  const x = Number(adjustments?.x) || 0;
  const y = Number(adjustments?.y) || 0;

  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const cover = Math.max(outW / iw, outH / ih);
  const contain = Math.min(outW / iw, outH / ih);
  const base = fitMode === 'fill' ? cover : contain;
  const scale = base * zoom;
  const dw = iw * scale;
  const dh = ih * scale;

  ctx.save();
  ctx.translate(outW / 2 + (x / 100) * outW, outH / 2 + (y / 100) * outH);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();

  const blob = await canvasToJpegBlob(canvas);
  return new File([blob], 'edited-preview.jpg', { type: 'image/jpeg' });
}

export default function AdminWebsitePhotoSlot({
  label,
  sizeLabel = '',
  frameImage = '',
  instructions = '',
  required = true,
  value = null,
  referenceValue = null,
  onChange,
  onReferenceChange,
  disabled = false,
  allowPreview = true,
  area: areaProp = null,
  extraLabel = '',
}) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const dims = useMemo(() => {
    if (areaProp && (Number(areaProp.width) > 0 || Number(areaProp.height) > 0)) {
      return {
        width: Number(areaProp.width) > 0 ? Number(areaProp.width) : 1,
        height: Number(areaProp.height) > 0 ? Number(areaProp.height) : 1,
        unit: areaProp.unit || 'inch',
      };
    }
    return parseSizeLabel(sizeLabel || label);
  }, [areaProp, sizeLabel, label]);

  const area = useMemo(() => ({
    label: areaProp?.label || label || sizeLabel || 'Photo',
    width: dims.width,
    height: dims.height,
    unit: dims.unit,
    frameImage: areaProp?.frameImage || frameImage || '',
    instructions: areaProp?.instructions || instructions || '',
  }), [areaProp, label, sizeLabel, dims, frameImage, instructions]);

  const photoUrl = value?.previewUrl || value?.displayUrl || value?.url || '';
  const originalUrl = value?.originalPreviewUrl || value?.originalUrl || '';
  const adjustments = value?.adjustments || getDefaultPreviewAdjustments();
  const oriented = useMemo(
    () => getFrameSize(area, adjustments.orientation),
    [area, adjustments.orientation],
  );
  const resolvedSizeLabel = sizeLabel || formatFrameSizeLabel(area) || '';

  const setPhoto = (next) => onChange?.(next);

  const handleUpload = async (files) => {
    const file = files?.[0];
    if (!file || disabled) return;
    setUploading(true);
    try {
      imagePerfMark('admin-slot:prepare:start');
      const prepared = await prepareImageUpload(file);
      imagePerfMeasure('admin-slot:prepare', 'admin-slot:prepare:start');
      const previewUrl = prepared.previewUrl || URL.createObjectURL(file);
      const nextAdjustments = adjustmentsForUploadedPhoto(
        prepared.width || 0,
        prepared.height || 0,
        area,
      );
      setPhoto({
        file,
        originalFile: file,
        previewUrl,
        displayUrl: previewUrl,
        originalPreviewUrl: previewUrl,
        name: file.name,
        type: file.type,
        size: file.size,
        width: prepared.width || 0,
        height: prepared.height || 0,
        adjustments: nextAdjustments,
        editedFile: null,
      });
      if (allowPreview) setEditorOpen(true);
    } catch (error) {
      console.error(error);
      const previewUrl = URL.createObjectURL(file);
      setPhoto({
        file,
        originalFile: file,
        previewUrl,
        originalPreviewUrl: previewUrl,
        name: file.name,
        type: file.type,
        size: file.size,
        adjustments: getDefaultPreviewAdjustments(),
      });
      if (allowPreview) setEditorOpen(true);
    } finally {
      setUploading(false);
    }
  };

  const handleApply = async (draft) => {
    if (!photoUrl && !originalUrl) return false;
    const sourceUrl = originalUrl || photoUrl;
    setSaving(true);
    try {
      const editedFile = await bakeEditedPreview({
        photoUrl: sourceUrl,
        area,
        adjustments: draft,
      });
      const previewUrl = URL.createObjectURL(editedFile);
      setPhoto({
        ...(value || {}),
        file: editedFile,
        editedFile,
        originalFile: value?.originalFile || value?.file || null,
        originalPreviewUrl: value?.originalPreviewUrl || originalUrl || photoUrl,
        previewUrl,
        displayUrl: previewUrl,
        name: editedFile.name,
        type: editedFile.type,
        size: editedFile.size,
        adjustments: { ...getDefaultPreviewAdjustments(), ...draft },
      });
      setEditorOpen(false);
      return true;
    } catch (error) {
      console.error(error);
      setPhoto({
        ...(value || {}),
        adjustments: { ...getDefaultPreviewAdjustments(), ...draft },
      });
      setEditorOpen(false);
      return true;
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = () => {
    if (value?.previewUrl?.startsWith?.('blob:')) {
      try { URL.revokeObjectURL(value.previewUrl); } catch {}
    }
    if (value?.originalPreviewUrl?.startsWith?.('blob:') && value.originalPreviewUrl !== value.previewUrl) {
      try { URL.revokeObjectURL(value.originalPreviewUrl); } catch {}
    }
    setPhoto(null);
    setEditorOpen(false);
  };

  const handleReferenceUpload = async (event) => {
    const file = event.target.files?.[0] || null;
    event.target.value = '';
    if (!file) return;
    let previewUrl = '';
    try {
      const prepared = await prepareImageUpload(file);
      previewUrl = prepared.previewUrl || URL.createObjectURL(file);
    } catch {
      previewUrl = URL.createObjectURL(file);
    }
    onReferenceChange?.({
      file,
      previewUrl,
      name: file.name,
      type: file.type,
      size: file.size,
    });
  };

  return (
    <div className="space-y-2 rounded-2xl border border-primary-100 bg-white p-3">
      <PhotoUploadCard
        label={label}
        sizeLabel={resolvedSizeLabel}
        required={required}
        missingRequired={required && !photoUrl}
        photoUrl={photoUrl}
        uploading={uploading || saving}
        disabled={disabled}
        orientation={adjustments.orientation}
        orientationLabel={photoUrl ? orientationCaption(adjustments.orientation) : ''}
        aspectWidth={oriented.width}
        aspectHeight={oriented.height}
        fitMode={adjustments.fitMode || 'fit'}
        instructions={area.instructions || instructions}
        onUpload={handleUpload}
        onRemove={handleRemove}
        onEdit={allowPreview && photoUrl ? () => setEditorOpen(true) : undefined}
      />

      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-3">
        <p className="text-xs font-bold text-gray-800">Reference image (optional)</p>
        <p className="mt-0.5 text-[11px] text-gray-500">
          Visual crop/edit guidance for the Editor — not the print photo.
        </p>
        <input
          type="file"
          accept="image/*,.heic,.heif"
          disabled={disabled}
          className="mt-2 block w-full text-xs"
          onChange={handleReferenceUpload}
        />
        {referenceValue?.previewUrl || referenceValue?.file ? (
          <div className="mt-2 flex items-center gap-2">
            {referenceValue.previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={referenceValue.previewUrl} alt="" className="h-12 w-12 rounded object-cover" />
            ) : null}
            <span className="truncate text-xs text-gray-600">{referenceValue.name || 'Reference'}</span>
            <button
              type="button"
              className="text-xs font-semibold text-red-700"
              disabled={disabled}
              onClick={() => onReferenceChange?.(null)}
            >
              Remove
            </button>
          </div>
        ) : null}
      </div>

      {allowPreview ? (
        <PhotoAdjuster
          open={editorOpen && Boolean(photoUrl || originalUrl)}
          label={label}
          extraLabel={extraLabel || ''}
          area={area}
          photoUrl={photoUrl || originalUrl}
          blobUrl={String(photoUrl || originalUrl || '').startsWith('blob:') ? (photoUrl || originalUrl) : ''}
          baseline={adjustments}
          saving={saving}
          onClose={() => setEditorOpen(false)}
          onApply={handleApply}
          onReplace={(file) => handleUpload([file])}
        />
      ) : null}
    </div>
  );
}
