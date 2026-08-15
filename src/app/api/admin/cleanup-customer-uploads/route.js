export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cleanupCustomerUploads } from '@/lib/customerUploadCleanup';

function getToken(req) {
  const authHeader = req.headers.get('authorization') || '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const headerToken = req.headers.get('x-cleanup-secret') || '';
  const { searchParams } = new URL(req.url);
  return bearer || headerToken || searchParams.get('secret') || '';
}

async function handleCleanup(req) {
  const expected = process.env.CLEANUP_SECRET;
  if (!expected) {
    return NextResponse.json({ error: 'CLEANUP_SECRET is not configured' }, { status: 503 });
  }

  if (getToken(req) !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const dryRun = searchParams.get('dryRun') === 'true';
  const retentionDays = Number(searchParams.get('retentionDays') || 30);
  const result = await cleanupCustomerUploads({ dryRun, retentionDays });

  return NextResponse.json(result);
}

export async function GET(req) {
  return handleCleanup(req);
}

export async function POST(req) {
  return handleCleanup(req);
}
