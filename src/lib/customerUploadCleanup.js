import { readdir, stat, unlink } from 'fs/promises';
import path from 'path';
import dbConnect from './db';
import Order from '../models/Order';

const CUSTOMIZATION_PREFIX = '/customizations/';
const DEFAULT_RETENTION_DAYS = 30;

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isCustomerUploadUrl(value) {
  return typeof value === 'string' && value.startsWith(CUSTOMIZATION_PREFIX);
}

function urlToFilePath(url) {
  if (!isCustomerUploadUrl(url)) return null;
  const filename = path.basename(url.slice(CUSTOMIZATION_PREFIX.length));
  if (!filename || filename === '.' || filename === '..') return null;
  return path.join(process.cwd(), 'public', 'customizations', filename);
}

function filePathToUrl(filename) {
  return `${CUSTOMIZATION_PREFIX}${filename}`;
}

function extractCustomizationUrls(value, urls = new Set()) {
  if (Array.isArray(value)) {
    value.forEach((item) => extractCustomizationUrls(item, urls));
    return urls;
  }

  if (!isPlainObject(value)) return urls;

  Object.values(value).forEach((entry) => {
    if (isCustomerUploadUrl(entry)) urls.add(entry);
    else extractCustomizationUrls(entry, urls);
  });

  return urls;
}

function redactCustomizationUrls(value, deletedAt, redactedUrls) {
  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((item) => {
      const result = redactCustomizationUrls(item, deletedAt, redactedUrls);
      if (result.changed) changed = true;
      return result.value;
    });
    return { value: changed ? next : value, changed };
  }

  if (!isPlainObject(value)) return { value, changed: false };

  let changed = false;
  let removedOwnUrl = false;
  const next = {};

  Object.entries(value).forEach(([key, entry]) => {
    if (key === 'url' && isCustomerUploadUrl(entry)) {
      redactedUrls.push(entry);
      changed = true;
      removedOwnUrl = true;
      return;
    }

    const result = redactCustomizationUrls(entry, deletedAt, redactedUrls);
    next[key] = result.value;
    if (result.changed) changed = true;
  });

  if (removedOwnUrl) {
    next.deleted = true;
    next.deletedAt = deletedAt;
  }

  return { value: changed ? next : value, changed };
}

async function collectProtectedUrls(cutoff) {
  const protectedUrls = new Set();
  const cursor = Order.find({ createdAt: { $gt: cutoff } }).select('items').lean().cursor();

  for await (const order of cursor) {
    for (const item of order.items || []) {
      extractCustomizationUrls(item.customFields, protectedUrls);
      extractCustomizationUrls(item.customizationPreview, protectedUrls);
    }
  }

  return protectedUrls;
}

async function redactOldOrderReferences(cutoff, dryRun) {
  const deletedAt = new Date().toISOString();
  const targetUrls = new Set();
  let ordersScanned = 0;
  let ordersUpdated = 0;
  let referencesRedacted = 0;

  const cursor = Order.find({ createdAt: { $lte: cutoff } }).select('items').lean().cursor();

  for await (const order of cursor) {
    ordersScanned += 1;
    let orderChanged = false;
    const orderRedactedUrls = [];
    const nextItems = (order.items || []).map((item) => {
      const customFields = redactCustomizationUrls(item.customFields, deletedAt, orderRedactedUrls);
      const customizationPreview = redactCustomizationUrls(item.customizationPreview, deletedAt, orderRedactedUrls);
      if (!customFields.changed && !customizationPreview.changed) return item;
      orderChanged = true;
      return {
        ...item,
        customFields: customFields.value,
        customizationPreview: customizationPreview.value,
      };
    });

    if (!orderChanged) continue;

    orderRedactedUrls.forEach((url) => targetUrls.add(url));
    referencesRedacted += orderRedactedUrls.length;
    ordersUpdated += 1;

    if (!dryRun) {
      await Order.updateOne({ _id: order._id }, { $set: { items: nextItems } });
    }
  }

  return { ordersScanned, ordersUpdated, referencesRedacted, targetUrls };
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

async function deleteCollectedFiles(targetUrls, protectedUrls, dryRun) {
  let filesDeleted = 0;
  let filesMissing = 0;
  let protectedFilesSkipped = 0;
  const handledPaths = new Set();

  for (const url of targetUrls) {
    if (protectedUrls.has(url)) {
      protectedFilesSkipped += 1;
      continue;
    }

    const filePath = urlToFilePath(url);
    if (!filePath || handledPaths.has(filePath)) continue;
    handledPaths.add(filePath);

    const result = await deleteFile(filePath, dryRun);
    if (result === 'missing') filesMissing += 1;
    else filesDeleted += 1;
  }

  return { filesDeleted, filesMissing, protectedFilesSkipped, handledPaths };
}

async function deleteOrphanedFiles(cutoff, protectedUrls, handledPaths, dryRun) {
  const uploadDir = path.join(process.cwd(), 'public', 'customizations');
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

    const filePath = path.join(uploadDir, entry.name);
    if (handledPaths.has(filePath)) continue;

    const fileStat = await stat(filePath);
    if (fileStat.mtime > cutoff) {
      recentFilesSkipped += 1;
      continue;
    }

    if (protectedUrls.has(filePathToUrl(entry.name))) {
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

  const protectedUrls = await collectProtectedUrls(cutoff);
  const orderResult = await redactOldOrderReferences(cutoff, dryRun);
  const fileResult = await deleteCollectedFiles(orderResult.targetUrls, protectedUrls, dryRun);
  const orphanResult = await deleteOrphanedFiles(cutoff, protectedUrls, fileResult.handledPaths, dryRun);

  return {
    dryRun,
    retentionDays,
    cutoff: cutoff.toISOString(),
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
