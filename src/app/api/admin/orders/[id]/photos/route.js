export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Order from '@/models/Order';
import { requireAdminPermission, logAdminAudit } from '@/lib/adminAccess';
import { saveUploadFile } from '@/lib/uploadStorage';
import { PRINTING_STARTED_OPS } from '@/lib/opsConstants';
import { appendTimeline, notifyAdmins } from '@/lib/opsOrderHelpers';

/** Replace/add customer photo on an order item. Blocked after printing starts. */
export async function POST(req, { params }) {
  const { error, access } = await requireAdminPermission('orders', 'write');
  if (error) return error;
  await dbConnect();
  const order = await Order.findById(params.id);
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  if (PRINTING_STARTED_OPS.has(order.opsStatus) || order.printingStartedAt) {
    return NextResponse.json({
      error: 'Customer photo replacement is blocked after printing has started',
    }, { status: 409 });
  }

  const form = await req.formData();
  const file = form.get('file');
  const itemIndex = Number(form.get('itemIndex') || 0);
  const slotKey = String(form.get('slotKey') || 'customer-photo').trim();
  const reason = String(form.get('reason') || '').trim();
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'Photo file is required' }, { status: 400 });
  }
  if (!order.items?.[itemIndex]) {
    return NextResponse.json({ error: 'Invalid item index' }, { status: 400 });
  }

  const saved = await saveUploadFile(file, 'customizations');
  const previousPath = order.items[itemIndex].image || '';
  order.items[itemIndex].image = saved.url;
  order.photoHistory = order.photoHistory || [];
  order.photoHistory.push({
    slotKey,
    previousPath,
    newPath: saved.relativePath,
    reason,
    replacedBy: access.adminId,
    replacedAt: new Date(),
  });

  appendTimeline(order, {
    type: 'photo_replaced',
    employee: access.adminId,
    employeeName: access.name || access.email || '',
    notes: reason || `Photo replaced for item ${itemIndex + 1}`,
    fileRef: saved.relativePath,
  });
  await order.save();

  await logAdminAudit({
    access,
    req,
    action: 'orders.photo_replace',
    targetType: 'Order',
    targetId: String(order._id),
    details: { slotKey, itemIndex, orderNumber: order.orderNumber },
  });

  if (order.assignedTo) {
    await notifyAdmins([order.assignedTo], {
      type: 'photo_replaced',
      title: 'Customer photo updated',
      body: `${order.orderNumber}: ${slotKey}`,
      order: order._id,
      orderNumber: order.orderNumber,
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, url: saved.url });
}
