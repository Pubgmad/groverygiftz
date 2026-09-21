const startsWithBytes = (buffer, bytes) => bytes.every((value, index) => buffer[index] === value);

const textAt = (buffer, start, length) => buffer.toString('ascii', start, start + length);

export function detectImageFormat(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) return null;

  if (startsWithBytes(buffer, [0xff, 0xd8, 0xff])) return { format: 'jpeg', mime: 'image/jpeg', isImage: true };
  if (startsWithBytes(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { format: 'png', mime: 'image/png', isImage: true };
  if (textAt(buffer, 0, 6) === 'GIF87a' || textAt(buffer, 0, 6) === 'GIF89a') return { format: 'gif', mime: 'image/gif', isImage: true };
  if (textAt(buffer, 0, 4) === 'RIFF' && textAt(buffer, 8, 4) === 'WEBP') return { format: 'webp', mime: 'image/webp', isImage: true };
  if (textAt(buffer, 0, 5) === '%PDF-') return { format: 'pdf', mime: 'application/pdf', isImage: false };

  if (textAt(buffer, 4, 4) === 'ftyp') {
    const brands = [];
    for (let offset = 8; offset + 4 <= Math.min(buffer.length, 64); offset += 4) brands.push(textAt(buffer, offset, 4));
    if (brands.some((brand) => ['avif', 'avis', 'av01'].includes(brand))) return { format: 'avif', mime: 'image/avif', isImage: true };
    if (brands.some((brand) => ['heic', 'heix', 'hevc', 'hevx', 'heif', 'mif1', 'msf1'].includes(brand))) return { format: 'heif', mime: 'image/heif', isImage: true, isHeif: true };
  }

  const leadingText = buffer.toString('utf8', 0, Math.min(buffer.length, 512)).replace(/^\uFEFF/, '').trimStart().toLowerCase();
  if (leadingText.startsWith('<svg') || leadingText.startsWith('<?xml') && leadingText.includes('<svg')) return { format: 'svg', mime: 'image/svg+xml', isImage: true };
  return null;
}

export function isSupportedUploadFormat(format, { allowPdf = false } = {}) {
  if (!format) return false;
  if (format.isImage) return true;
  return allowPdf && format.format === 'pdf';
}
