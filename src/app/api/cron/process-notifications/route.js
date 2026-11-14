import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { processOrderConfirmationJobs } from '@/lib/orderConfirmationOutbox';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function authorized(req) {
  const expected = String(process.env.CRON_SECRET || process.env.CLEANUP_SECRET || '').trim();
  if (!expected) return false;
  const authHeader = req.headers.get('authorization') || '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const headerToken = req.headers.get('x-cleanup-secret') || req.headers.get('x-cron-secret') || '';
  const { searchParams } = new URL(req.url);
  const token = bearer || headerToken || searchParams.get('secret') || '';
  return token === expected;
}

async function handle(req) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await dbConnect();
  const result = await processOrderConfirmationJobs({ limit: 20 });
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(req) {
  return handle(req);
}

export async function POST(req) {
  return handle(req);
}
