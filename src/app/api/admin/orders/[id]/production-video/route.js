export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Order from '@/models/Order';
import { requireAdminPermission, logAdminAudit } from '@/lib/adminAccess';
import { saveUploadFile } from '@/lib/uploadStorage';
import { appendTimeline, notifyAdmins } from '@/lib/opsOrderHelpers';

export async function POST(req, { params }) {
  const { error, access } = await requireAdminPermission('orders', 'write');
  if (error) return error;
  await dbConnect();
  const order = await Order.findById(params.id);
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  const form = await req.formData();
  const file = form.get('file');
  const notes = String(form.get('notes') || '').trim();
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'Video file is required' }, { status: 400 });
  }
  const type = String(file.type || '');
  if (type && !type.startsWith('video/') && type !== 'application/octet-stream') {
    return NextResponse.json({ error: 'Upload a video file' }, { status: 400 });
  }
  if (Number(file.size || 0) > 400 * 1024 * 1024) {
    return NextResponse.json({ error: 'Video must be under 400MB' }, { status: 400 });
  }

  const saved = await saveUploadFile(file, 'production-videos');
  order.productionVideos = order.productionVideos || [];
  order.productionVideos.push({
    filePath: saved.relativePath,
    url: saved.url,
    uploadedBy: access.adminId,
    uploadedByName: access.name || access.email || '',
    uploadedAt: new Date(),
    notes,
  });
  appendTimeline(order, {
    type: 'production_video',
    employee: access.adminId,
    employeeName: access.name || access.email || '',
    notes: notes || 'Production video uploaded',
    fileRef: saved.relativePath,
  });
  await order.save();

  await logAdminAudit({
    access,
    req,
    action: 'orders.production_video',
    targetType: 'Order',
    targetId: String(order._id),
    details: { orderNumber: order.orderNumber },
  });

  const recipients = [order.assignedTo, order.createdByAdmin].filter(Boolean);
  await notifyAdmins(recipients, {
    type: 'production_video',
    title: 'Production video uploaded',
    body: `${order.orderNumber} has a new completion video`,
    order: order._id,
    orderNumber: order.orderNumber,
  }).catch(() => {});

  return NextResponse.json({ ok: true, count: order.productionVideos.length, url: saved.url });
}
