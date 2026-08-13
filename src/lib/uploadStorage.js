import { mkdir, readFile, stat, unlink, writeFile } from 'fs/promises';
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

export async function saveUploadFile(file, relativeDir) {
  const filename = makeStoredFilename(file);
  const relativePath = cleanRelativePath(path.posix.join(relativeDir, filename));
  const filePath = storagePath(relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  const bytes = await file.arrayBuffer();
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
