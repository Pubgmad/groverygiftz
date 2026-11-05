export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Order from '@/models/Order';
import { requireAdminPermission, logAdminAudit } from '@/lib/adminAccess';
import { saveUploadFile } from '@/lib/uploadStorage';
import { buildCustomerDisplayUrl } from '@/lib/customerFileAccess';
import { PRINTING_STARTED_OPS } from '@/lib/opsConstants';
import { appendTimeline, notifyAdmins } from '@/lib/opsOrderHelpers';
import { assertCanAccessOrder } from '@/lib/opsStaffAccess';

function assetUrl(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'object') {
    return String(value.displayUrl || value.url || value.previewUrl || value.originalUrl || '').trim();
  }
  return '';
}

function isImageLike(value) {
  if (!value) return false;
  if (typeof value === 'string') return /^https?:\/\//i.test(value) || value.startsWith('/') || /\.(png|jpe?g|webp|gif|avif|svg|heic|heif)(\?|#|$)/i.test(value);
  if (typeof value !== 'object') return false;
  const type = String(value.type || '').toLowerCase();
  const url = assetUrl(value).toLowerCase();
  if (!url) return false;
  return type.startsWith('image/') || /\.(png|jpe?g|webp|gif|avif|svg|heic|heif)(\?|#|$)/.test(url) || url.startsWith('data:image/') || url.includes('/api/customization-upload/') || url.includes('/media/customizations/');
}

function buildReplacementAsset(previous, saved, file) {
  const type = String(file?.type || 'image/jpeg');
  const encodedPath = String(saved.relativePath || '')
    .split('/')
    .map(encodeURIComponent)
    .join('/');
  const originalUrl = encodedPath
    ? `/api/customization-upload/original-file/${encodedPath}?name=${encodeURIComponent(file?.name || previous?.name || 'customer-photo')}`
    : saved.url;
  const displayUrl = buildCustomerDisplayUrl(saved.relativePath) || saved.url;
  const base = {
    url: originalUrl,
    originalUrl,
    displayUrl,
    storagePath: saved.relativePath || '',
    previewStoragePath: '',
    type: type || previous?.type || 'image',
    name: file?.name || previous?.name || 'customer-photo',
    size: Number(file?.size || previous?.size || 0) || undefined,
  };
  if (previous && typeof previous === 'object') {
    return { ...previous, ...base };
  }
  return base;
}

function parseFieldPath(fieldPath = '') {
  return String(fieldPath || '')
    .split(/[.[\]]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function getByPath(root, parts) {
  let cur = root;
  for (let i = 0; i < parts.length; i += 1) {
    if (cur == null) return { parent: null, key: null, value: undefined };
    const key = /^\d+$/.test(parts[i]) ? Number(parts[i]) : parts[i];
    if (i === parts.length - 1) {
      return { parent: cur, key, value: cur?.[key] };
    }
    cur = cur[key];
  }
  return { parent: null, key: null, value: undefined };
}

function itemHasConfiguredCustomerImages(item) {
  const fields = item?.customFields;
  if (fields && typeof fields === 'object') {
    for (const [label, value] of Object.entries(fields)) {
      if (label === 'Variant Label Uploads' && value && typeof value === 'object') {
        if (Object.values(value).some((entry) => isImageLike(entry))) return true;
      } else if (Array.isArray(value) && value.some((entry) => isImageLike(entry))) {
        return true;
      } else if (isImageLike(value)) {
        return true;
      }
    }
  }
  if (Array.isArray(item?.collageUploads)) {
    for (const group of item.collageUploads) {
      if ((group?.images || []).some((entry) => isImageLike(entry))) return true;
    }
  }
  return false;
}

/**
 * Prefer customFields / collageUploads customer assets; fall back to item.image
 * only when that is the sole image on the line item.
 */
function replaceCustomerPhoto(item, { slotKey, fieldPath, saved, file }) {
  // Explicit fieldPath wins
  if (fieldPath) {
    const parts = parseFieldPath(fieldPath);
    if (parts[0] === 'items') parts.shift();
    // paths relative to item: customFields.X.0 / collageUploads.0.images.1 / image
    const target = getByPath(item, parts);
    if (target.parent && target.key !== null && target.key !== undefined) {
      const previousPath = assetUrl(target.value);
      const next = typeof target.value === 'string'
        ? saved.url
        : buildReplacementAsset(target.value, saved, file);
      target.parent[target.key] = next;
      return { previousPath, target: parts.join('.') };
    }
  }

  const key = String(slotKey || '').trim();

  // collageUploads: match group label or "collage:<label>:<index>" / "collage-0-1"
  if (Array.isArray(item.collageUploads) && item.collageUploads.length) {
    for (let g = 0; g < item.collageUploads.length; g += 1) {
      const group = item.collageUploads[g];
      const images = Array.isArray(group.images) ? group.images : [];
      const label = String(group.label || '');
      let index = -1;
      if (key && (key === label || key.toLowerCase() === `collage:${label.toLowerCase()}`)) {
        index = 0;
      } else {
        const m = key.match(new RegExp(`^(?:collage[:\\-]?)${g}[:\\-](\\d+)$`, 'i'))
          || (label ? key.match(new RegExp(`^collage[:\\-]?${label.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}[:\\-](\\d+)$`, 'i')) : null);
        if (m) index = Number(m[1]);
        else if (/^\d+$/.test(key) && g === 0) index = Number(key);
      }
      if (index >= 0 && index < images.length) {
        const previousPath = assetUrl(images[index]);
        images[index] = buildReplacementAsset(images[index], saved, file);
        group.images = images;
        item.collageUploads[g] = group;
        return { previousPath, target: `collageUploads.${g}.images.${index}` };
      }
      // If slot matches label and only one image, replace it
      if (key && key === label && images.length === 1) {
        const previousPath = assetUrl(images[0]);
        images[0] = buildReplacementAsset(images[0], saved, file);
        group.images = images;
        item.collageUploads[g] = group;
        return { previousPath, target: `collageUploads.${g}.images.0` };
      }
    }
  }

  // customFields image-like values
  if (item.customFields && typeof item.customFields === 'object') {
    const fields = item.customFields;

    // Variant Label Uploads
    if (fields['Variant Label Uploads'] && typeof fields['Variant Label Uploads'] === 'object') {
      const uploads = fields['Variant Label Uploads'];
      if (key && uploads[key] && isImageLike(uploads[key])) {
        const previousPath = assetUrl(uploads[key]);
        uploads[key] = buildReplacementAsset(uploads[key], saved, file);
        fields['Variant Label Uploads'] = uploads;
        item.customFields = fields;
        return { previousPath, target: `customFields.Variant Label Uploads.${key}` };
      }
    }

    // Named field / Customer Photos array
    for (const [label, value] of Object.entries(fields)) {
      if (label === 'Variant Label Uploads') continue;

      if (Array.isArray(value)) {
        let index = -1;
        if (key === label || key.toLowerCase() === 'customer-photo' || key.toLowerCase() === 'customer photos') {
          index = 0;
        } else if (/^\d+$/.test(key)) {
          index = Number(key);
        } else {
          const m = key.match(new RegExp(`^${label.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}[:\\-](\\d+)$`, 'i'))
            || key.match(/^customer[- ]?photos?[:\\-](\d+)$/i)
            || key.match(/^item-\d+-(\d+)$/i);
          if (m) index = Number(m[1]);
        }
        if (index >= 0 && index < value.length && isImageLike(value[index])) {
          const previousPath = assetUrl(value[index]);
          value[index] = buildReplacementAsset(value[index], saved, file);
          fields[label] = value;
          item.customFields = fields;
          return { previousPath, target: `customFields.${label}.${index}` };
        }
        // First image-like entry in preferred Customer Photos when slot is generic
        if ((key === 'customer-photo' || key.startsWith('item-') || !key) && label === 'Customer Photos') {
          const idx = value.findIndex((entry) => isImageLike(entry));
          if (idx >= 0) {
            const previousPath = assetUrl(value[idx]);
            value[idx] = buildReplacementAsset(value[idx], saved, file);
            fields[label] = value;
            item.customFields = fields;
            return { previousPath, target: `customFields.${label}.${idx}` };
          }
        }
      } else if (isImageLike(value) && (key === label || key === 'customer-photo' || !key)) {
        const previousPath = assetUrl(value);
        fields[label] = typeof value === 'string'
          ? saved.url
          : buildReplacementAsset(value, saved, file);
        item.customFields = fields;
        return { previousPath, target: `customFields.${label}` };
      }
    }
  }

  // Fall back to item.image only when it is the only image
  if (!itemHasConfiguredCustomerImages(item) && item.image) {
    const previousPath = assetUrl(item.image);
    item.image = saved.url;
    return { previousPath, target: 'image' };
  }

  // Last resort: if item.image exists even alongside others and nothing matched, still allow explicit item-* slots
  if (item.image && (key.startsWith('item-') || key === 'image' || !itemHasConfiguredCustomerImages(item))) {
    const previousPath = assetUrl(item.image);
    item.image = saved.url;
    return { previousPath, target: 'image' };
  }

  return null;
}

function appendCustomerPhoto(item, { saved, file, slotLabel = 'Customer Photos' }) {
  if (!item.customFields || typeof item.customFields !== 'object') {
    item.customFields = {};
  }
  const label = String(slotLabel || 'Customer Photos').trim() || 'Customer Photos';
  const existing = item.customFields[label];
  const arr = Array.isArray(existing) ? [...existing] : (existing && isImageLike(existing) ? [existing] : []);
  arr.push(buildReplacementAsset(null, saved, file));
  item.customFields[label] = arr;
  return {
    previousPath: '',
    target: `customFields.${label}.${arr.length - 1}`,
    photoIndex: arr.length - 1,
  };
}

/** Add or replace customer photo on an order item/size. Blocked after printing starts. */
export async function POST(req, { params }) {
  const { error, access } = await requireAdminPermission('orders', 'write');
  if (error) return error;
  await dbConnect();
  const order = await Order.findById(params.id);
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  if (!assertCanAccessOrder(access, order)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (PRINTING_STARTED_OPS.has(order.opsStatus) || order.printingStartedAt) {
    return NextResponse.json({
      error: 'Customer photo replacement is blocked after printing has started',
    }, { status: 409 });
  }

  const form = await req.formData();
  const file = form.get('file');
  const itemIndex = Number(form.get('itemIndex') || 0);
  const slotKey = String(form.get('slotKey') || 'customer-photo').trim();
  const fieldPath = String(form.get('fieldPath') || '').trim();
  const reason = String(form.get('reason') || '').trim();
  const mode = String(form.get('mode') || 'auto').toLowerCase();
  const slotLabel = String(form.get('slotLabel') || 'Customer Photos').trim() || 'Customer Photos';
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'Photo file is required' }, { status: 400 });
  }
  if (!order.items?.[itemIndex]) {
    return NextResponse.json({ error: 'Invalid item index' }, { status: 400 });
  }

  const saved = await saveUploadFile(file, 'customizations');
  const item = order.items[itemIndex];
  let result = null;
  let actionType = 'photo_replaced';

  if (mode === 'append' || mode === 'add') {
    result = appendCustomerPhoto(item, { saved, file, slotLabel });
    actionType = 'photo_added';
  } else {
    result = replaceCustomerPhoto(item, { slotKey, fieldPath, saved, file });
    if (!result && (mode === 'auto' || mode === 'replace_or_append')) {
      result = appendCustomerPhoto(item, { saved, file, slotLabel });
      actionType = 'photo_added';
    }
  }

  if (!result) {
    return NextResponse.json({
      error: 'No replaceable customer photo found for this item/slot. Use mode=append to add a new photo.',
    }, { status: 400 });
  }

  order.markModified(`items.${itemIndex}`);
  order.photoHistory = order.photoHistory || [];
  order.photoHistory.push({
    slotKey: fieldPath || slotKey || `${slotLabel}:${itemIndex}`,
    previousPath: result.previousPath || '',
    newPath: saved.relativePath,
    reason,
    replacedBy: access.adminId,
    replacedAt: new Date(),
  });

  appendTimeline(order, {
    type: actionType,
    employee: access.adminId,
    employeeName: access.name || access.email || '',
    notes: reason || `Photo ${actionType === 'photo_added' ? 'added' : 'replaced'} for item ${itemIndex + 1} (${result.target})`,
    fileRef: saved.relativePath,
  });
  await order.save();

  await logAdminAudit({
    access,
    req,
    action: actionType === 'photo_added' ? 'orders.photo_add' : 'orders.photo_replace',
    targetType: 'Order',
    targetId: String(order._id),
    details: { slotKey, fieldPath, itemIndex, target: result.target, mode, orderNumber: order.orderNumber },
  });

  if (order.assignedTo) {
    await notifyAdmins([order.assignedTo], {
      type: actionType,
      title: 'Customer photo updated',
      body: `${order.orderNumber}: item ${itemIndex + 1}`,
      order: order._id,
      orderNumber: order.orderNumber,
    }).catch(() => {});
  }

  return NextResponse.json({
    ok: true,
    url: saved.url,
    previousPath: result.previousPath,
    target: result.target,
    mode: actionType === 'photo_added' ? 'append' : 'replace',
    itemIndex,
  });
}
