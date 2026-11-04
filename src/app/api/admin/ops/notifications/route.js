export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import OpsNotification from '@/models/OpsNotification';
import { requireAdminPermission } from '@/lib/adminAccess';

export async function GET(req) {
  const { error, access } = await requireAdminPermission('orders', 'read');
  if (error) return error;
  await dbConnect();
  const unreadOnly = new URL(req.url).searchParams.get('unread') === '1';
  const filter = { recipient: access.adminId };
  if (unreadOnly) filter.readAt = { $exists: false };
  const notifications = await OpsNotification.find(filter).sort({ createdAt: -1 }).limit(50).lean();
  const unreadCount = await OpsNotification.countDocuments({ recipient: access.adminId, readAt: { $exists: false } });
  return NextResponse.json({ notifications, unreadCount });
}

export async function PATCH(req) {
  const { error, access } = await requireAdminPermission('orders', 'read');
  if (error) return error;
  const body = await req.json();
  await dbConnect();
  if (body.markAllRead) {
    await OpsNotification.updateMany(
      { recipient: access.adminId, readAt: { $exists: false } },
      { $set: { readAt: new Date() } },
    );
    return NextResponse.json({ ok: true });
  }
  if (body.id) {
    await OpsNotification.updateOne(
      { _id: body.id, recipient: access.adminId },
      { $set: { readAt: new Date() } },
    );
  }
  return NextResponse.json({ ok: true });
}
