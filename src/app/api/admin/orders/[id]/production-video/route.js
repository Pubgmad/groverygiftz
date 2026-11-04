export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Order from '@/models/Order';
import { requireAdminPermission, logAdminAudit } from '@/lib/adminAccess';
import { saveUploadFile } from '@/lib/uploadStorage';
import { appendTimeline, notifyRoleSlugs } from '@/lib/opsOrderHelpers';
import { assertCanAccessOrder } from '@/lib/opsStaffAccess';
import {
  buildProductionVideoShareUrl,
  buildWhatsAppVideoShareUrl,
} from '@/lib/productionVideoToken';

export async function POST(req, { params }) {
  const { error, access } = await requireAdminPermission('orders', 'write');
  if (error) return error;
  await dbConnect();
  const order = await Order.findById(params.id);
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  if (!assertCanAccessOrder(access, order)) {
    return NextResponse.json({ error: 'You do not have access to this order' }, { status: 403 });
  }

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

  const video = order.productionVideos[order.productionVideos.length - 1];
  const origin = req.headers.get('origin') || process.env.NEXTAUTH_URL || 'https://groverygiftz.in';
  const shareUrl = buildProductionVideoShareUrl(saved.relativePath, origin);
  const phone = order.shippingAddress?.whatsappNumber || order.shippingAddress?.phone;
  const whatsappShareUrl = buildWhatsAppVideoShareUrl(
    phone,
    `Hi ${order.shippingAddress?.fullName || 'there'}, your GroveryGiftz product video for ${order.orderNumber}: ${shareUrl}`,
  );

  await logAdminAudit({
    access,
    req,
    action: 'orders.production_video',
    targetType: 'Order',
    targetId: String(order._id),
    details: { orderNumber: order.orderNumber },
  });

  await notifyRoleSlugs(['sales-person'], {
    type: 'production_video',
    title: 'Production video uploaded',
    body: `${order.orderNumber} has a new completion video`,
    order: order._id,
    orderNumber: order.orderNumber,
    alsoInclude: [order.assignedTo, order.createdByAdmin].filter(Boolean),
  }).catch(() => {});

  return NextResponse.json({
    ok: true,
    count: order.productionVideos.length,
    url: saved.url,
    shareUrl,
    whatsappShareUrl,
    videoId: String(video._id),
  });
}

/** Generate WhatsApp share link for an existing production video. */
export async function GET(req, { params }) {
  const { error, access } = await requireAdminPermission('orders', 'read');
  if (error) return error;
  await dbConnect();
  const order = await Order.findById(params.id)
    .select('orderNumber shippingAddress productionVideos assignedTo createdByAdmin printingAssignedTo')
    .lean();
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  if (!assertCanAccessOrder(access, order)) {
    return NextResponse.json({ error: 'You do not have access to this order' }, { status: 403 });
  }
  const videoId = new URL(req.url).searchParams.get('videoId');
  const video = (order.productionVideos || []).find((v) => String(v._id) === String(videoId))
    || (order.productionVideos || [])[(order.productionVideos || []).length - 1];
  if (!video) return NextResponse.json({ error: 'No production video' }, { status: 404 });
  const origin = req.headers.get('origin') || process.env.NEXTAUTH_URL || 'https://groverygiftz.in';
  const shareUrl = buildProductionVideoShareUrl(video.filePath || '', origin) || video.url;
  const phone = order.shippingAddress?.whatsappNumber || order.shippingAddress?.phone;
  const whatsappShareUrl = buildWhatsAppVideoShareUrl(
    phone,
    `Hi ${order.shippingAddress?.fullName || 'there'}, your GroveryGiftz product video for ${order.orderNumber}: ${shareUrl}`,
  );
  return NextResponse.json({ shareUrl, whatsappShareUrl, url: video.url });
}
