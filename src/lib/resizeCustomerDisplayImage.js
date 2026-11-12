/**
 * Server-only derived JPEG thumbs. Never writes, overwrites, or deletes originals.
 */
import { boundedThumbWidth } from '@/lib/adminImageThumb';

export async function maybeResizeImageBuffer(buffer, { width = 320, mime = '' } = {}) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 32) return null;
  const type = String(mime || '').toLowerCase();
  if (
    type.includes('svg')
    || type.includes('gif')
    || type.includes('pdf')
    || type.includes('heic')
    || type.includes('heif')
  ) {
    return null;
  }
  try {
    const sharpMod = await import('sharp');
    const sharp = sharpMod.default || sharpMod;
    const out = await sharp(buffer, { failOn: 'none', sequentialRead: true })
      .rotate()
      .resize({
        width: boundedThumbWidth(width),
        height: boundedThumbWidth(width),
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 72, mozjpeg: true })
      .toBuffer();
    if (!out || out.length < 32) return null;
    return { buffer: out, contentType: 'image/jpeg' };
  } catch {
    return null;
  }
}
