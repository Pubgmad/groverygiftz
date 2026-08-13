import { readdir, stat, unlink } from 'fs/promises';
import path from 'path';
import dbConnect from './db';
import Order from '../models/Order';
import { storagePath } from './uploadStorage';

const CUSTOMIZATION_DIR = 'customizations';
const LEGACY_CUSTOMIZATION_PREFIX = '/customizations/';
const ORIGINAL_FILE_PREFIX = '/api/customization-upload/original-file/';
const DEFAULT_RETENTION_DAYS = 30;
const CUSTOMER_UPLOAD_KEYS = new Set(['url', 'originalUrl', 'storagePath']);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function cleanCustomizationPath(value = '') {
  const normalized = String(value || '').replace(/\\/g, '/').replace(/^\/+/, '').split('?')[0];
  if (!normalized.startsWith(`${CUSTOMIZATION_DIR}/`)) return null;
  const parts = normalized.split('/').filter(Boolean);
  if (parts.length < 2 || parts[0] !== CUSTOMIZATION_DIR) return null;
  return parts.map((part) => part.replace(/[^a-zA-Z0-9._-]/g, '_')).join('/');
}

function customerUploadPath(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  let pathname = value.trim();

  try {
    if (/^https?:\/\//i.test(pathname)) pathname = new URL(pathname).pathname;
  } catch (error) {}

  pathname = pathname.split('?')[0];

  if (pathname.startsWith(ORIGINAL_FILE_PREFIX)) {
    return cleanCustomizationPath(pathname.slice(ORIGINAL_FILE_PREFIX.length));
  }

  if (pathname.startsWith(LEGACY_CUSTOMIZATION_PREFIX)) {
    return cleanCustomizationPath(`${CUSTOMIZATION_DIR}/${pathname.slice(LEGACY_CUSTOMIZATION_PREFIX.length)}`);
  }

  return cleanCustomizationPath(pathname);
}

function customerUploadUrl(relativePath) {
  const cleanPath = cleanCustomizationPath(relativePath);
  return cleanPath ? `/${cleanPath}` : '';
}

function extractCustomizationPaths(value, paths = new Set()) {
  if (typeof value === 'string') {
    const uploadPath = customerUploadPath(value);
    if (uploadPath) paths.add(uploadPath);
    return paths;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => extractCustomizationPaths(item, paths));
    return paths;
  }

  if (!isPlainObject(value)) return paths;

  Object.values(value).forEach((entry) => extractCustomizationPaths(entry, paths));
  return paths;
}

function redactCustomizationPaths(value, deletedAt, redactedPaths) {
  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((item) => {
      const result = redactCustomizationPaths(item, deletedAt, redactedPaths);
      if (result.changed) changed = true;
      return result.value;
    });
    return { value: changed ? next : value, changed };
  }

  if (!isPlainObject(value)) return { value, changed: false };

  let changed = false;
  let removedOwnUpload = false;
  const next = {};

  Object.entries(value).forEach(([key, entry]) => {
    const uploadPath = CUSTOMER_UPLOAD_KEYS.has(key) ? customerUploadPath(entry) : null;
    if (uploadPath) {
      redactedPaths.push(uploadPath);
      changed = true;
      removedOwnUpload = true;
      return;
    }

    const result = redactCustomizationPaths(entry, deletedAt, redactedPaths);
    next[key] = result.value;
    if (result.changed) changed = true;
  });

  if (removedOwnUpload) {
    next.deleted = true;
    next.deletedAt = deletedAt;
  }

  return { value: changed ? next : value, changed };
}

async function collectProtectedPaths(cutoff) {
  const protectedPaths = new Set();
  const cursor = Order.find({ createdAt: { $gt: cutoff } }).select('items').lean().cursor();

  for await (const order of cursor) {
    for (const item of order.items || []) {
      extractCustomizationPaths(item.customFields, protectedPaths);
      extractCustomizationPaths(item.customizationPreview, protectedPaths);
      extractCustomizationPaths(item.collageUploads, protectedPaths);
    }
  }

  return protectedPaths;
}

async function redactOldOrderReferences(cutoff, dryRun) {
  const deletedAt = new Date().toISOString();
  const targetPaths = new Set();
  let ordersScanned = 0;
  let ordersUpdated = 0;
  let referencesRedacted = 0;

  const cursor = Order.find({ createdAt: { $lte: cutoff } }).select('items').lean().cursor();

  for await (const order of cursor) {
    ordersScanned += 1;
    let orderChanged = false;
    const orderRedactedPaths = [];
    const nextItems = (order.items || []).map((item) => {
      const customFields = redactCustomizationPaths(item.customFields, deletedAt, orderRedactedPaths);
      const customizationPreview = redactCustomizationPaths(item.customizationPreview, deletedAt, orderRedactedPaths);
      const collageUploads = redactCustomizationPaths(item.collageUploads, deletedAt, orderRedactedPaths);
      if (!customFields.changed && !customizationPreview.changed && !collageUploads.changed) return item;
      orderChanged = true;
      return {
        ...item,
        customFields: customFields.value,
        customizationPreview: customizationPreview.value,
        collageUploads: collageUploads.value,
      };
    });

    if (!orderChanged) continue;

    orderRedactedPaths.forEach((uploadPath) => targetPaths.add(uploadPath));
    referencesRedacted += orderRedactedPaths.length;
    ordersUpdated += 1;

    if (!dryRun) {
      await Order.updateOne({ _id: order._id }, { $set: { items: nextItems } });
    }
  }

  return { ordersScanned, ordersUpdated, referencesRedacted, targetPaths };
}

async function deleteFile(filePath, dryRun) {
  if (dryRun) return 'deleted';
  try {
    await unlink(filePath);
    return 'deleted';
  } catch (error) {
    if (error?.code === 'ENOENT') return 'missing';
    throw error;
  }
}

async function deleteCollectedFiles(targetPaths, protectedPaths, dryRun) {
  let filesDeleted = 0;
  let filesMissing = 0;
  let protectedFilesSkipped = 0;
  const handledPaths = new Set();

  for (const uploadPath of targetPaths) {
    if (protectedPaths.has(uploadPath)) {
      protectedFilesSkipped += 1;
      continue;
    }

    const filePath = storagePath(uploadPath);
    if (!filePath || handledPaths.has(filePath)) continue;
    handledPaths.add(filePath);

    const result = await deleteFile(filePath, dryRun);
    if (result === 'missing') filesMissing += 1;
    else filesDeleted += 1;
  }

  return { filesDeleted, filesMissing, protectedFilesSkipped, handledPaths };
}

async function deleteOrphanedFiles(cutoff, protectedPaths, handledPaths, dryRun) {
  const uploadDir = storagePath(CUSTOMIZATION_DIR);
  let orphanFilesDeleted = 0;
  let orphanFilesMissing = 0;
  let recentFilesSkipped = 0;
  let protectedFilesSkipped = 0;

  let entries = [];
  try {
    entries = await readdir(uploadDir, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return { orphanFilesDeleted, orphanFilesMissing, recentFilesSkipped, protectedFilesSkipped };
    }
    throw error;
  }

  for (const entry of entries) {
    if (!entry.isFile()) continue;

    const uploadPath = `${CUSTOMIZATION_DIR}/${entry.name}`;
    const filePath = storagePath(uploadPath);
    if (!filePath || handledPaths.has(filePath)) continue;

    const fileStat = await stat(filePath);
    if (fileStat.mtime > cutoff) {
      recentFilesSkipped += 1;
      continue;
    }

    if (protectedPaths.has(uploadPath) || protectedPaths.has(customerUploadUrl(uploadPath))) {
      protectedFilesSkipped += 1;
      continue;
    }

    const result = await deleteFile(filePath, dryRun);
    if (result === 'missing') orphanFilesMissing += 1;
    else orphanFilesDeleted += 1;
  }

  return { orphanFilesDeleted, orphanFilesMissing, recentFilesSkipped, protectedFilesSkipped };
}

export async function cleanupCustomerUploads(options = {}) {
  const retentionDays = Number(options.retentionDays || DEFAULT_RETENTION_DAYS);
  const dryRun = Boolean(options.dryRun);
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  await dbConnect();

  const protectedPaths = await collectProtectedPaths(cutoff);
  const orderResult = await redactOldOrderReferences(cutoff, dryRun);
  const fileResult = await deleteCollectedFiles(orderResult.targetPaths, protectedPaths, dryRun);
  const orphanResult = await deleteOrphanedFiles(cutoff, protectedPaths, fileResult.handledPaths, dryRun);

  return {
    dryRun,
    retentionDays,
    cutoff: cutoff.toISOString(),
    target: `${CUSTOMIZATION_DIR}/`,
    ordersScanned: orderResult.ordersScanned,
    ordersUpdated: orderResult.ordersUpdated,
    referencesRedacted: orderResult.referencesRedacted,
    filesDeleted: fileResult.filesDeleted + orphanResult.orphanFilesDeleted,
    filesMissing: fileResult.filesMissing + orphanResult.orphanFilesMissing,
    protectedFilesSkipped: fileResult.protectedFilesSkipped + orphanResult.protectedFilesSkipped,
    recentFilesSkipped: orphanResult.recentFilesSkipped,
    orphanFilesDeleted: orphanResult.orphanFilesDeleted,
  };
}
