const HEIF_MIME = /image\/(heic|heif)(?:-sequence)?$/i;
const HEIF_NAME = /\.(heic|heif)$/i;

const asciiAt = (bytes, start, length) => String.fromCharCode(...bytes.slice(start, start + length));

/** Read JPEG EXIF Orientation (tag 0x0112). Returns 1–8, or 1 when absent. */
async function readJpegExifOrientation(file) {
  try {
    const header = new DataView(await file.slice(0, Math.min(file.size, 128 * 1024)).arrayBuffer());
    if (header.byteLength < 4 || header.getUint16(0) !== 0xffd8) return 1;
    let offset = 2;
    while (offset + 4 <= header.byteLength) {
      const marker = header.getUint16(offset);
      offset += 2;
      if ((marker & 0xff00) !== 0xff00) break;
      if (marker === 0xffda) break;
      if (offset + 2 > header.byteLength) break;
      const size = header.getUint16(offset);
      if (size < 2) break;
      if (marker === 0xffe1 && offset + size <= header.byteLength) {
        const exifStart = offset + 2;
        if (header.getUint32(exifStart) !== 0x45786966) break; // Exif
        const tiff = exifStart + 6;
        const little = header.getUint16(tiff) === 0x4949;
        const get16 = (at) => (little ? header.getUint16(at, true) : header.getUint16(at, false));
        const get32 = (at) => (little ? header.getUint32(at, true) : header.getUint32(at, false));
        const ifd0 = tiff + get32(tiff + 4);
        if (ifd0 + 2 > header.byteLength) break;
        const entries = get16(ifd0);
        for (let i = 0; i < entries; i += 1) {
          const entry = ifd0 + 2 + i * 12;
          if (entry + 12 > header.byteLength) break;
          if (get16(entry) === 0x0112) {
            const value = get16(entry + 8);
            return value >= 1 && value <= 8 ? value : 1;
          }
        }
        break;
      }
      offset += size;
    }
  } catch {
    return 1;
  }
  return 1;
}

function orientedDimensions(width, height, orientation) {
  const rotated = orientation >= 5 && orientation <= 8;
  return {
    width: rotated ? height : width,
    height: rotated ? width : height,
  };
}

const inspectImageHeader = async (file) => {
  const bytes = new Uint8Array(await file.slice(0, 64).arrayBuffer());
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (asciiAt(bytes, 0, 8) === '\x89PNG\r\n\x1a\n') return 'png';
  if (asciiAt(bytes, 0, 6) === 'GIF87a' || asciiAt(bytes, 0, 6) === 'GIF89a') return 'gif';
  if (asciiAt(bytes, 0, 4) === 'RIFF' && asciiAt(bytes, 8, 4) === 'WEBP') return 'webp';
  if (asciiAt(bytes, 4, 4) === 'ftyp') {
    const brands = [];
    for (let offset = 8; offset + 4 <= bytes.length; offset += 4) brands.push(asciiAt(bytes, offset, 4));
    if (brands.some((brand) => ['avif', 'avis', 'av01'].includes(brand))) return 'avif';
    if (brands.some((brand) => ['heic', 'heix', 'hevc', 'hevx', 'heif', 'mif1', 'msf1'].includes(brand))) return 'heif';
  }
  return '';
};

export async function prepareImageUpload(file) {
  if (!file) return { previewUrl: '', previewFile: null };

  const signature = await inspectImageHeader(file).catch(() => '');
  const heif = signature ? signature === 'heif' : HEIF_MIME.test(String(file.type || '')) || HEIF_NAME.test(String(file.name || ''));
  if (heif) {
    try {
      const { heicTo } = await import('heic-to');
      const previewBlob = await heicTo({ blob: file, type: 'image/jpeg', quality: 0.92 });
      const previewUrl = URL.createObjectURL(previewBlob);
      const image = await verifyImageDecode(previewUrl);
      return {
        previewUrl,
        previewFile: previewBlob,
        previewName: `${String(file.name || 'image').replace(/\.[^.]+$/, '') || 'image'}-preview.jpg`,
        width: image.naturalWidth,
        height: image.naturalHeight,
      };
    } catch (error) {
      throw new Error('This HEIC/HEIF image could not be converted for preview. Please export it as JPG and try again.');
    }
  }

  const browserImage = signature || String(file.type || '').startsWith('image/') || /\.(jpe?g|png|webp|gif|avif|svg)$/i.test(String(file.name || ''));
  const detectedMime = { jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif' }[signature];
  const previewBlob = detectedMime && file.type !== detectedMime ? file.slice(0, file.size, detectedMime) : file;
  const previewUrl = browserImage ? URL.createObjectURL(previewBlob) : '';

  // Prefer createImageBitmap with EXIF orientation applied — deterministic across browsers.
  if (previewUrl && typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(previewBlob, { imageOrientation: 'from-image' });
      const width = bitmap.width;
      const height = bitmap.height;
      bitmap.close?.();
      // Still decode via <img> so blob URL is validated for later previews.
      await verifyImageDecode(previewUrl);
      return { previewUrl, previewFile: null, previewName: '', width, height };
    } catch {
      // Fall through to Image + EXIF heuristic.
    }
  }

  const image = previewUrl ? await verifyImageDecode(previewUrl) : null;
  let width = image?.naturalWidth || 0;
  let height = image?.naturalHeight || 0;
  // Fallback for engines that ignore EXIF on naturalWidth: swap only when the file
  // tag says 90/270 and the reported aspect still matches the unrotated file.
  if (signature === 'jpeg' && width > 0 && height > 0) {
    const orientation = await readJpegExifOrientation(file);
    if (orientation >= 5 && orientation <= 8) {
      const looksUnrotated = (orientation === 6 || orientation === 8) ? width >= height : height >= width;
      if (looksUnrotated) {
        const oriented = orientedDimensions(width, height, orientation);
        width = oriented.width;
        height = oriented.height;
      }
    }
  }
  return {
    previewUrl,
    previewFile: null,
    previewName: '',
    width,
    height,
  };
}

export function verifyImageDecode(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timer = setTimeout(() => finish(new Error('Image loading timed out. Please try again.')), 30000);
    const finish = (error) => {
      clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      if (error) { URL.revokeObjectURL(url); reject(error); }
      else resolve(image);
    };
    image.onload = () => finish(image.naturalWidth > 0 && image.naturalHeight > 0 ? null : new Error('This image could not be decoded. Please choose a valid image.'));
    image.onerror = () => finish(new Error('This image could not be decoded. Please export it as JPG or PNG and try again.'));
    image.src = url;
  });
}

export function appendImageUpload(formData, file, prepared) {
  formData.append('file', file);
  if (prepared?.previewFile) formData.append('preview', prepared.previewFile, prepared.previewName || 'image-preview.jpg');
}

export function attachLocalPreview(upload, prepared) {
  return {
    ...upload,
    previewUrl: prepared?.previewUrl || upload?.previewUrl || upload?.displayUrl || upload?.url || '',
    width: prepared?.width || upload?.width || 0,
    height: prepared?.height || upload?.height || 0,
  };
}
