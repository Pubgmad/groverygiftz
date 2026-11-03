import { NextResponse } from 'next/server';
import { detectImageFormat, isSupportedUploadFormat } from '@/lib/imageFormat';
import { buildCustomerDisplayUrl } from '@/lib/customerFileAccess';
import { saveUploadFile } from '@/lib/uploadStorage';

const MAX_FILE_SIZE = 500 * 1024 * 1024;

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req) {
  try {
    let formData;
    try {
      formData = await req.formData();
    } catch {
      // Proxy/body-size rejections often surface here; always answer with JSON (never HTML).
      return NextResponse.json({ error: 'This photo is too large for the server. Please choose a smaller image and try again.' }, { status: 413 });
    }
    const file = formData.get('file');
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'File must be under 500 MB' }, { status: 400 });

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const format = detectImageFormat(fileBuffer);
    if (!isSupportedUploadFormat(format, { allowPdf: true })) return NextResponse.json({ error: 'Only valid JPG, PNG, WEBP, GIF, AVIF, SVG, HEIC, HEIF or PDF files are allowed' }, { status: 400 });

    const preview = formData.get('preview');
    let previewFormat = null;
    let previewBuffer = null;
    if (format.isHeif) {
      if (!preview || !preview.size) return NextResponse.json({ error: 'HEIC/HEIF preview conversion failed. Please choose the image again.' }, { status: 415 });
      previewBuffer = Buffer.from(await preview.arrayBuffer());
      previewFormat = detectImageFormat(previewBuffer);
      if (!previewFormat?.isImage || !['jpeg', 'png', 'webp'].includes(previewFormat.format)) return NextResponse.json({ error: 'Invalid compatible preview image' }, { status: 400 });
    }

    const stored = await saveUploadFile(file, 'customizations', { buffer: fileBuffer });
    const previewStored = format.isHeif ? await saveUploadFile(preview, 'customizations/previews', { buffer: previewBuffer }) : null;
    const encodedPath = stored.relativePath.split('/').map(encodeURIComponent).join('/');
    const originalUrl = `/api/customization-upload/original-file/${encodedPath}?name=${encodeURIComponent(file.name)}`;
    const displayPath = previewStored?.relativePath || stored.relativePath;
    const displayUrl = buildCustomerDisplayUrl(displayPath);
    return NextResponse.json({ name: file.name, type: format.mime, size: file.size, url: originalUrl, originalUrl, displayUrl, storagePath: stored.relativePath, previewStoragePath: previewStored?.relativePath || '', previewType: previewFormat?.mime || '' }, { status: 201 });
  } catch (error) {
    const message = String(error?.message || '');
    if (/ENOSPC|EROFS|EACCES|ENOENT/i.test(message)) {
      return NextResponse.json({ error: 'Unable to store the photo on the server. Please try again shortly.' }, { status: 500 });
    }
    return NextResponse.json({ error: 'Failed to upload customization file' }, { status: 500 });
  }
}