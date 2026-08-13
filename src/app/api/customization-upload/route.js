import { NextResponse } from 'next/server';
import { saveUploadFile } from '@/lib/uploadStorage';

const MAX_FILE_SIZE = 500 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence', 'application/pdf'];

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    if (!ALLOWED_TYPES.includes(file.type)) return NextResponse.json({ error: 'Only JPG, PNG, WEBP, GIF, HEIC, HEIF or PDF files are allowed' }, { status: 400 });
    if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'File must be under 500 MB' }, { status: 400 });

    const stored = await saveUploadFile(file, 'customizations');
    const encodedPath = stored.relativePath.split('/').map(encodeURIComponent).join('/');
    const originalUrl = `/api/customization-upload/original-file/${encodedPath}?name=${encodeURIComponent(file.name)}`;
    return NextResponse.json({ name: file.name, type: file.type, size: file.size, url: originalUrl, originalUrl, storagePath: stored.relativePath }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to upload customization file' }, { status: 500 });
  }
}
