export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Order from '@/models/Order';
import { requireAdminPermission, logAdminAudit } from '@/lib/adminAccess';
import { saveUploadFile } from '@/lib/uploadStorage';
import { appendTimeline, notifyAdmins, notifyRoleSlugs } from '@/lib/opsOrderHelpers';
import { createDesignPreviewToken, buildDesignPreviewUrl, buildWhatsAppShareUrl } from '@/lib/designPreviewToken';
import { canPrintDesign, requiresPaidRevisionGate } from '@/lib/opsConstants';
import { assertCanAccessOrder } from '@/lib/opsStaffAccess';

const ALLOWED = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf',
]);

export async function GET(_req, { params }) {
  const { error, access } = await requireAdminPermission('orders', 'read');
  if (error) return error;
  await dbConnect();
  const order = await Order.findById(params.id)
    .select('orderNumber designVersions currentDesignVersion designApprovalStatus designApprovedVersion designChangeRequest designApprovalHistory previewRequired opsStatus assignedTo createdByAdmin printingAssignedTo shippingAddress.whatsappNumber shippingAddress.phone')
    .lean();
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  if (!assertCanAccessOrder(access, order)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return NextResponse.json({
    order,
    canPrintDesign: canPrintDesign(order),
  });
}

export async function POST(req, { params }) {
  const { error, access } = await requireAdminPermission('orders', 'write');
  if (error) return error;
  await dbConnect();
  const order = await Order.findById(params.id);
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  if (!assertCanAccessOrder(access, order)) {
    return NextResponse.json({ error: 'You do not have access to this order' }, { status: 403 });
  }
  if (requiresPaidRevisionGate(order)) {
    return NextResponse.json({
      error: 'Paid revision charge must be recorded and verified before uploading another design',
    }, { status: 409 });
  }

  const form = await req.formData();
  const file = form.get('file');
  const notes = String(form.get('notes') || '').trim();
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'Design file is required' }, { status: 400 });
  }
  const type = String(file.type || '').toLowerCase();
  if (type && !ALLOWED.has(type) && !type.startsWith('image/')) {
    return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
  }
  if (Number(file.size || 0) > 80 * 1024 * 1024) {
    return NextResponse.json({ error: 'Design file must be under 80MB' }, { status: 400 });
  }

  const saved = await saveUploadFile(file, 'designs');
  const nextVersion = Math.max(0, Number(order.currentDesignVersion) || 0) + 1;
  order.designVersions = order.designVersions || [];
  order.designVersions.push({
    version: nextVersion,
    filePath: saved.relativePath,
    url: saved.url,
    originalUrl: saved.url,
    mimeType: type || 'application/octet-stream',
    size: Number(file.size) || 0,
    uploadedBy: access.adminId,
    uploadedByName: access.name || access.email || '',
    notes,
    uploadedAt: new Date(),
  });
  order.currentDesignVersion = nextVersion;
  order.designApprovedVersion = 0;
  order.designApprovedAt = undefined;
  if (order.previewRequired === false) {
    order.designApprovalStatus = 'approved';
    order.designApprovedVersion = nextVersion;
    order.designApprovedAt = new Date();
    order.opsStatus = 'approved_printing_pending';
  } else {
    order.designApprovalStatus = 'awaiting_approval';
    order.opsStatus = 'preview_waiting';
  }

  appendTimeline(order, {
    type: 'design_uploaded',
    previousStatus: order.designApprovalStatus,
    newStatus: order.designApprovalStatus,
    employee: access.adminId,
    employeeName: access.name || access.email || '',
    notes: `Design v${nextVersion} uploaded`,
    fileRef: saved.relativePath,
  });

  await order.save();
  await logAdminAudit({
    access,
    req,
    action: 'orders.design_upload',
    targetType: 'Order',
    targetId: String(order._id),
    details: { version: nextVersion, orderNumber: order.orderNumber },
  });

  await notifyRoleSlugs(['sales-person'], {
    type: 'design_uploaded',
    title: 'Design ready',
    body: `${order.orderNumber} design v${nextVersion} uploaded`,
    order: order._id,
    orderNumber: order.orderNumber,
    alsoInclude: [order.assignedTo, order.createdByAdmin].filter(Boolean),
  }).catch(() => {});
  if (order.assignedTo) {
    await notifyAdmins([order.assignedTo], {
      type: 'design_uploaded',
      title: 'Design ready',
      body: `${order.orderNumber} design v${nextVersion} uploaded`,
      order: order._id,
      orderNumber: order.orderNumber,
    }).catch(() => {});
  }

  const token = createDesignPreviewToken(order._id, nextVersion);
  const origin = req.headers.get('origin') || process.env.NEXTAUTH_URL || 'https://groverygiftz.in';
  const previewUrl = buildDesignPreviewUrl(token, origin);
  const phone = order.shippingAddress?.whatsappNumber || order.shippingAddress?.phone;
  const shareUrl = buildWhatsAppShareUrl(
    phone,
    `Hi ${order.shippingAddress?.fullName || 'there'}, your GroveryGiftz design preview for ${order.orderNumber} is ready: ${previewUrl}`,
  );

  return NextResponse.json({
    version: nextVersion,
    designApprovalStatus: order.designApprovalStatus,
    opsStatus: order.opsStatus,
    previewUrl,
    whatsappShareUrl: shareUrl,
    canPrintDesign: canPrintDesign(order),
  });
}
