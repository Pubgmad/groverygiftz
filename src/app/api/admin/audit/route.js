import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import AdminAuditLog from '@/models/AdminAuditLog';
import { requirePrimaryAdmin } from '@/lib/adminAccess';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { error } = await requirePrimaryAdmin();
  if (error) return error;
  await dbConnect();
  const logs = await AdminAuditLog.find().sort({ createdAt: -1 }).limit(40).lean();
  return NextResponse.json({ logs });
}
