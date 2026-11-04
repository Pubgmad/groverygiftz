export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Order from '@/models/Order';
import { requireAdminPermission, logAdminAudit } from '@/lib/adminAccess';
import { createDesignPreviewToken, buildDesignPreviewUrl, buildWhatsAppShareUrl } from '@/lib/designPreviewToken';
import { appendTimeline } from '@/lib/opsOrderHelpers';

export async function POST(req, { params }) {
  const { error, access } = await requireAdminPermission('orders', 'write');
  if (error) return error;
  await dbConnect();
  const order = await Order.findById(params.id);
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  if (!order.currentDesignVersion) {
    return NextResponse.json({ error: 'Upload a design before sharing preview' }, { status: 400 });
  }

  const token = createDesignPreviewToken(order._id, order.currentDesignVersion);
  const origin = req.headers.get('origin') || process.env.NEXTAUTH_URL || 'https://groverygiftz.in';
  const previewUrl = buildDesignPreviewUrl(token, origin);
  const phone = order.shippingAddress?.whatsappNumber || order.shippingAddress?.phone;
  const message = `Hi ${order.shippingAddress?.fullName || 'there'}, your GroveryGiftz design preview for order ${order.orderNumber} is ready. Please review and approve here: ${previewUrl}`;
  const whatsappShareUrl = buildWhatsAppShareUrl(phone, message);

  if (order.previewRequired !== false && order.designApprovalStatus === 'not_uploaded') {
    order.designApprovalStatus = 'awaiting_approval';
  }
  if (order.previewRequired !== false) {
    order.opsStatus = 'preview_waiting';
  }

  appendTimeline(order, {
    type: 'design_share_opened',
    newStatus: order.designApprovalStatus,
    employee: access.adminId,
    employeeName: access.name || access.email || '',
    notes: 'WhatsApp click-to-chat share link generated (not delivery confirmation)',
  });
  await order.save();

  await logAdminAudit({
    access,
    req,
    action: 'orders.design_share_link',
    targetType: 'Order',
    targetId: String(order._id),
    details: { orderNumber: order.orderNumber, version: order.currentDesignVersion },
  });

  return NextResponse.json({
    previewUrl,
    whatsappShareUrl,
    message,
    note: 'Opening WhatsApp does not confirm the message was sent.',
  });
}
