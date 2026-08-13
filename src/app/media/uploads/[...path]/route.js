import { NextResponse } from 'next/server';
import path from 'path';
import { readUploadFile } from '@/lib/uploadStorage';

export const dynamic = 'force-dynamic';

const CONTENT_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
};

function contentTypeFor(relativePath = '') {
  return CONTENT_TYPES[path.extname(relativePath).toLowerCase()] || 'application/octet-stream';
}

export async function GET(req, { params }) {
  try {
    const { path: pathParts = [] } = await params;
    const relativePath = ['uploads', ...pathParts].join('/');
    const file = await readUploadFile(relativePath);
    if (!file) return NextResponse.json({ error: 'File not found' }, { status: 404 });
    return new NextResponse(file.buffer, {
      headers: {
        'Content-Type': contentTypeFor(relativePath),
        'Content-Length': String(file.stat.size),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}
