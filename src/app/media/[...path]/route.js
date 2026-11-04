import { NextResponse } from 'next/server';
import path from 'path';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { can, getRequestAdminAccess } from '@/lib/adminAccess';
import { readUploadFile } from '@/lib/uploadStorage';
import { detectImageFormat } from '@/lib/imageFormat';
import { verifyProductionVideoShareToken } from '@/lib/productionVideoToken';

export const dynamic = 'force-dynamic';

const VIDEO_TYPES = { '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime' };
const PUBLIC_TOP = new Set(['uploads', 'designs']);
const ADMIN_ONLY_TOP = new Set(['payment-proofs', 'customizations']);

async function authorizeMediaRequest(req, relativePath) {
  const top = String(relativePath || '').split('/')[0];

  if (PUBLIC_TOP.has(top)) return { ok: true, cache: 'public' };

  if (top === 'production-videos') {
    const session = await getServerSession(authOptions);
    const access = await getRequestAdminAccess(session);
    if (can(access, 'orders', 'read')) return { ok: true, cache: 'private' };

    const share = req.nextUrl?.searchParams?.get('share') || '';
    const verified = verifyProductionVideoShareToken(share);
    if (verified?.relativePath && verified.relativePath === relativePath) {
      return { ok: true, cache: 'private' };
    }
    return { ok: false, status: share ? 403 : 401 };
  }

  if (ADMIN_ONLY_TOP.has(top)) {
    const session = await getServerSession(authOptions);
    const access = await getRequestAdminAccess(session);
    if (!session?.user || session.user.type !== 'admin') {
      return { ok: false, status: 401 };
    }
    if (!can(access, 'orders', 'read')) return { ok: false, status: 403 };
    return { ok: true, cache: 'private' };
  }

  return { ok: false, status: 403 };
}

export async function GET(req, { params }) {
  try {
    const { path: pathParts = [] } = await params;
    const parts = Array.isArray(pathParts) ? pathParts : [pathParts];
    const relativePath = parts.map((p) => String(p || '').trim()).filter(Boolean).join('/');
    if (!relativePath || relativePath.includes('..')) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const auth = await authorizeMediaRequest(req, relativePath);
    if (!auth.ok) {
      return NextResponse.json(
        { error: auth.status === 401 ? 'Unauthorized' : 'Forbidden' },
        { status: auth.status || 403 },
      );
    }

    const file = await readUploadFile(relativePath);
    if (!file) return NextResponse.json({ error: 'File not found' }, { status: 404 });

    const format = detectImageFormat(file.buffer);
    const videoType = VIDEO_TYPES[path.extname(relativePath).toLowerCase()] || '';
    const cacheControl = auth.cache === 'public'
      ? 'public, max-age=31536000, immutable'
      : 'private, no-store';

    return new NextResponse(file.buffer, {
      headers: {
        'Content-Type': format?.mime || videoType || 'application/octet-stream',
        'Content-Length': String(file.stat.size),
        'Cache-Control': cacheControl,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}
