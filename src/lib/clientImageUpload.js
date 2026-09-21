const HEIF_MIME = /image\/(heic|heif)(?:-sequence)?$/i;
const HEIF_NAME = /\.(heic|heif)$/i;

const asciiAt = (bytes, start, length) => String.fromCharCode(...bytes.slice(start, start + length));

const inspectImageHeader = async (file) => {
  const bytes = new Uint8Array(await file.slice(0, 64).arrayBuffer());
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (asciiAt(bytes, 0, 8) === '\x89PNG\r\n\x1a\n') return 'png';
  if (asciiAt(bytes, 0, 6) === 'GIF87a' || asciiAt(bytes, 0, 6) === 'GIF89a') return 'gif';
  if (asciiAt(bytes, 0, 4) === 'RIFF' && asciiAt(bytes, 8, 4) === 'WEBP') return 'webp';
  if (asciiAt(bytes, 4, 4) === 'ftyp') {
    const brands = [];
    for (let offset = 8; offset + 4 <= bytes.length; offset += 4) brands.push(asciiAt(bytes, offset, 4));
    if (brands.some((brand) => ['heic', 'heix', 'hevc', 'hevx', 'heif', 'mif1', 'msf1'].includes(brand))) return 'heif';
    if (brands.some((brand) => ['avif', 'avis', 'av01'].includes(brand))) return 'avif';
  }
  return '';
};

export async function prepareImageUpload(file) {
  if (!file) return { previewUrl: '', previewFile: null };

  const signature = await inspectImageHeader(file).catch(() => '');
  const heif = signature === 'heif' || HEIF_MIME.test(String(file.type || '')) || HEIF_NAME.test(String(file.name || ''));
  if (heif) {
    try {
      const { heicTo } = await import('heic-to');
      const previewBlob = await heicTo({ blob: file, type: 'image/jpeg', quality: 0.92 });
      return {
        previewUrl: URL.createObjectURL(previewBlob),
        previewFile: previewBlob,
        previewName: `${String(file.name || 'image').replace(/\.[^.]+$/, '') || 'image'}-preview.jpg`,
      };
    } catch (error) {
      throw new Error('This HEIC/HEIF image could not be converted for preview. Please export it as JPG and try again.');
    }
  }

  const browserImage = signature || String(file.type || '').startsWith('image/') || /\.(jpe?g|png|webp|gif|avif|svg)$/i.test(String(file.name || ''));
  return {
    previewUrl: browserImage ? URL.createObjectURL(file) : '',
    previewFile: null,
    previewName: '',
  };
}

export function appendImageUpload(formData, file, prepared) {
  formData.append('file', file);
  if (prepared?.previewFile) formData.append('preview', prepared.previewFile, prepared.previewName || 'image-preview.jpg');
}

export function attachLocalPreview(upload, prepared) {
  return {
    ...upload,
    previewUrl: prepared?.previewUrl || upload?.previewUrl || upload?.displayUrl || upload?.url || '',
  };
}