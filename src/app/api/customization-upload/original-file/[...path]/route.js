import { NextResponse } from 'next/server';
import path from 'path';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readUploadFile } from '@/lib/uploadStorage';

export const dynamic = 'force-dynamic';

export async function GET(req, { params }) {
  const session = await getServerSession(authOptions);
  if (session?.user?.type !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { path: pathParts = [] } = await params;
    const relativePath = pathParts.join('/');
    if (!relativePath.startsWith('customizations/')) return NextResponse.json({ error: 'Invalid file' }, { status: 400 });
    const file = await readUploadFile(relativePath);
    if (!file) return NextResponse.json({ error: 'Original file not found' }, { status: 404 });
    const downloadName = new URL(req.url).searchParams.get('name') || path.basename(relativePath);
    return new NextResponse(file.buffer, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(file.stat.size),
        'Content-Disposition': `attachment; filename="${downloadName.replace(/"/g, '')}"`,
        'Cache-Control': 'private, no-transform',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Original file not found' }, { status: 404 });
  }
}
