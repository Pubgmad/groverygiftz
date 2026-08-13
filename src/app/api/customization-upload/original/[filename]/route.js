import { NextResponse } from 'next/server';
import { readFile, stat } from 'fs/promises';
import path from 'path';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

function safeCustomizationPath(filename = '') {
  const safeName = path.basename(decodeURIComponent(filename));
  if (!safeName || safeName === '.' || safeName === '..') return null;
  return path.join(process.cwd(), 'public', 'customizations', safeName);
}

export async function GET(req, { params }) {
  const session = await getServerSession(authOptions);
  if (session?.user?.type !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { filename } = await params;
    const filePath = safeCustomizationPath(filename);
    if (!filePath) return NextResponse.json({ error: 'Invalid file' }, { status: 400 });

    const [buffer, fileStat] = await Promise.all([readFile(filePath), stat(filePath)]);
    const downloadName = new URL(req.url).searchParams.get('name') || path.basename(filePath);

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(fileStat.size),
        'Content-Disposition': `attachment; filename="${downloadName.replace(/"/g, '')}"`,
        'Cache-Control': 'private, no-transform',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Original file not found' }, { status: 404 });
  }
}
