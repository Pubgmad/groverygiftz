import { NextResponse } from 'next/server';
import path from 'path';
import { readUploadFile } from '@/lib/uploadStorage';
import { detectImageFormat } from '@/lib/imageFormat';

export const dynamic = 'force-dynamic';

const VIDEO_TYPES = { '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime' };

export async function GET(req, { params }) {
  try {
    const { path: pathParts = [] } = await params;
    const relativePath = ['uploads', ...pathParts].join('/');
    const file = await readUploadFile(relativePath);
    if (!file) return NextResponse.json({ error: 'File not found' }, { status: 404 });
    const format = detectImageFormat(file.buffer);
    const videoType = VIDEO_TYPES[path.extname(relativePath).toLowerCase()] || '';
    return new NextResponse(file.buffer, {
      headers: {
        'Content-Type': format?.mime || videoType || 'application/octet-stream',
        'Content-Length': String(file.stat.size),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}