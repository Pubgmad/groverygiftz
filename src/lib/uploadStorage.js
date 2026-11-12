import { mkdir, readdir, readFile, stat, unlink, writeFile } from 'fs/promises';
import path from 'path';

const STORAGE_ROOT = process.env.UPLOAD_STORAGE_DIR || path.join(process.cwd(), '.data', 'uploads');
const PUBLIC_BASE_URL = (process.env.UPLOAD_PUBLIC_BASE_URL || '').replace(/\/$/, '');

function cleanSegment(value = '') {
  return String(value).replace(/[^a-zA-Z0-9._-]/g, '_') || 'file';
}

function cleanRelativePath(value = '') {
  const normalized = String(value).replace(/\\/g, '/').replace(/^\/+/, '');
  const parts = normalized.split('/').map(cleanSegment).filter(Boolean);
  if (parts.length === 0) return null;
  return parts.join('/');
}

export function makeStoredFilename(file) {
  const originalName = cleanSegment(file?.name || 'file');
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${originalName}`;
}

export function publicAssetUrl(relativePath) {
  const cleanPath = cleanRelativePath(relativePath);
  if (!cleanPath) return '';
  const localUrl = `/media/${cleanPath}`;
  return PUBLIC_BASE_URL ? `${PUBLIC_BASE_URL}${localUrl}` : localUrl;
}

export function pathFromPublicUrl(url = '') {
  const raw = String(url || '');
  let pathname = raw;
  try {
    if (/^https?:\/\//i.test(raw)) pathname = new URL(raw).pathname;
  } catch (error) {}
  pathname = pathname.split('?')[0];
  const prefixes = ['/media/', '/uploads/', '/customizations/'];
  const prefix = prefixes.find((entry) => pathname.startsWith(entry));
  if (!prefix) return null;
  const rest = pathname.slice(prefix.length);
  const relativePath = prefix === '/uploads/' ? `uploads/${rest}` : prefix === '/customizations/' ? `customizations/${rest}` : rest;
  return cleanRelativePath(relativePath);
}

export function storagePath(relativePath) {
  const cleanPath = cleanRelativePath(relativePath);
  if (!cleanPath) return null;
  return path.join(STORAGE_ROOT, cleanPath);
}

export async function saveUploadFile(file, relativeDir, { buffer } = {}) {
  const filename = makeStoredFilename(file);
  const relativePath = cleanRelativePath(path.posix.join(relativeDir, filename));
  const filePath = storagePath(relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  // Prefer a caller-provided buffer so routes that already read the file for validation
  // do not pay a second full arrayBuffer() on large uploads.
  const bytes = buffer || await file.arrayBuffer();
  await writeFile(filePath, Buffer.from(bytes));
  return { filename, relativePath, url: publicAssetUrl(relativePath) };
}

export async function readUploadFile(relativePath) {
  const filePath = storagePath(relativePath);
  if (!filePath) return null;
  const [buffer, fileStat] = await Promise.all([readFile(filePath), stat(filePath)]);
  return { buffer, stat: fileStat, filePath };
}

export async function deleteUploadByUrl(url) {
  const relativePath = pathFromPublicUrl(url);
  if (!relativePath) return false;
  const filePath = storagePath(relativePath);
  if (!filePath) return false;
  try {
    await unlink(filePath);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

export const uploadStorageRoot = STORAGE_ROOT;

/**
 * List files under a storage-relative directory (non-recursive one level by default).
 * Used by Admin 3D asset picker — never lists customer customization uploads.
 */
export async function listUploadFiles(relativeDir, { recursive = true, extensions = null } = {}) {
  const cleanDir = cleanRelativePath(relativeDir);
  if (!cleanDir) return [];
  const absRoot = storagePath(cleanDir);
  if (!absRoot) return [];

  const extSet = Array.isArray(extensions) && extensions.length
    ? new Set(extensions.map((e) => String(e).toLowerCase()))
    : null;

  async function walk(absDir, relDir, depth) {
    let entries = [];
    try {
      entries = await readdir(absDir, { withFileTypes: true });
    } catch (error) {
      if (error?.code === 'ENOENT') return [];
      throw error;
    }
    const out = [];
    for (const entry of entries) {
      const abs = path.join(absDir, entry.name);
      const rel = path.posix.join(relDir, entry.name);
      if (entry.isDirectory()) {
        if (recursive && depth < 6) out.push(...await walk(abs, rel, depth + 1));
        continue;
      }
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (extSet && !extSet.has(ext)) continue;
      let fileStat = null;
      try { fileStat = await stat(abs); } catch { continue; }
      out.push({
        filename: entry.name,
        relativePath: rel,
        url: publicAssetUrl(rel),
        size: fileStat.size,
        mtimeMs: fileStat.mtimeMs,
      });
    }
    return out;
  }

  return walk(absRoot, cleanDir, 0);
}
