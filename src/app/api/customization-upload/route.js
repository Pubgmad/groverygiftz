import { NextResponse } from 'next/server';
import { detectImageFormat, isSupportedUploadFormat } from '@/lib/imageFormat';
import { saveUploadFile } from '@/lib/uploadStorage';

const MAX_FILE_SIZE = 500 * 1024 * 1024;

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'File must be under 500 MB' }, { status: 400 });

    const format = detectImageFormat(Buffer.from(await file.arrayBuffer()));
    if (!isSupportedUploadFormat(format, { allowPdf: true })) return NextResponse.json({ error: 'Only valid JPG, PNG, WEBP, GIF, AVIF, SVG, HEIC, HEIF or PDF files are allowed' }, { status: 400 });

    const preview = formData.get('preview');
    let previewFormat = null;
    if (format.isHeif) {
      if (!preview || !preview.size) return NextResponse.json({ error: 'HEIC/HEIF preview conversion failed. Please choose the image again.' }, { status: 415 });
      previewFormat = detectImageFormat(Buffer.from(await preview.arrayBuffer()));
      if (!previewFormat?.isImage || !['jpeg', 'png', 'webp'].includes(previewFormat.format)) return NextResponse.json({ error: 'Invalid compatible preview image' }, { status: 400 });
    }

    const stored = await saveUploadFile(file, 'customizations');
    const previewStored = format.isHeif ? await saveUploadFile(preview, 'customizations/previews') : null;
    const encodedPath = stored.relativePath.split('/').map(encodeURIComponent).join('/');
    const originalUrl = `/api/customization-upload/original-file/${encodedPath}?name=${encodeURIComponent(file.name)}`;
    const originalDisplayUrl = `/api/customization-upload/customer-file/${encodedPath}`;
    const previewEncodedPath = previewStored?.relativePath?.split('/').map(encodeURIComponent).join('/');
    const displayUrl = previewEncodedPath ? `/api/customization-upload/customer-file/${previewEncodedPath}` : originalDisplayUrl;
    return NextResponse.json({ name: file.name, type: format.mime, size: file.size, url: originalUrl, originalUrl, displayUrl, storagePath: stored.relativePath, previewStoragePath: previewStored?.relativePath || '', previewType: previewFormat?.mime || '' }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to upload customization file' }, { status: 500 });
  }
}