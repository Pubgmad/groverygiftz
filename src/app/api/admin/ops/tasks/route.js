export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import OpsTask from '@/models/OpsTask';
import Order from '@/models/Order';
import Admin from '@/models/Admin';
import { requireAdminPermission, logAdminAudit } from '@/lib/adminAccess';
import { TASK_TYPES, TASK_PRIORITIES, TASK_STATUSES } from '@/lib/opsConstants';
import { notifyAdmins } from '@/lib/opsOrderHelpers';

export async function GET(req) {
  let { error, access } = await requireAdminPermission('operations', 'read');
  if (error) {
    const fallback = await requireAdminPermission('orders', 'read');
    if (fallback.error) return error;
    access = fallback.access;
  }
  await dbConnect();
  const { searchParams } = new URL(req.url);
  const view = searchParams.get('view') || 'today';
  const type = searchParams.get('type') || '';
  const filter = {};
  if (type && TASK_TYPES.includes(type)) filter.type = type;
  if (searchParams.get('mine') === '1' && access?.adminId) {
    filter.assignedTo = access.adminId;
  }

  const now = new Date();
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const endToday = new Date(now);
  endToday.setHours(23, 59, 59, 999);
  const endTomorrow = new Date(endToday);
  endTomorrow.setDate(endTomorrow.getDate() + 1);
  const endWeek = new Date(endToday);
  endWeek.setDate(endWeek.getDate() + 7);

  if (view === 'today') {
    filter.dueDate = { $gte: startToday, $lte: endToday };
  } else if (view === 'tomorrow') {
    filter.dueDate = { $gt: endToday, $lte: endTomorrow };
  } else if (view === 'week') {
    filter.dueDate = { $gte: startToday, $lte: endWeek };
  } else if (view === 'overdue') {
    filter.dueDate = { $lt: startToday };
    filter.status = { $in: ['pending', 'in_progress', 'blocked'] };
  }

  const tasks = await OpsTask.find(filter).sort({ dueDate: 1, priority: -1 }).limit(200).lean();
  return NextResponse.json({ tasks, view });
}

export async function POST(req) {
  let { error, access } = await requireAdminPermission('operations', 'write');
  if (error) {
    const fallback = await requireAdminPermission('orders', 'write');
    if (fallback.error) return error;
    access = fallback.access;
  }
  const body = await req.json();
  if (!TASK_TYPES.includes(body.type)) {
    return NextResponse.json({ error: 'Invalid task type' }, { status: 400 });
  }
  await dbConnect();
  const order = await Order.findById(body.orderId).select('orderNumber').lean();
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  let assignedTo = null;
  if (body.assignedTo && mongoose.Types.ObjectId.isValid(String(body.assignedTo))) {
    const admin = await Admin.findById(body.assignedTo).select('_id').lean();
    assignedTo = admin?._id || null;
  }

  const task = await OpsTask.create({
    order: order._id,
    orderNumber: order.orderNumber,
    type: body.type,
    title: String(body.title || `${body.type} task`).trim(),
    priority: TASK_PRIORITIES.includes(body.priority) ? body.priority : 'normal',
    status: 'pending',
    assignedTo: assignedTo || undefined,
    assignedBy: access.adminId,
    startDate: body.startDate ? new Date(body.startDate) : new Date(),
    dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
    notes: String(body.notes || '').trim(),
    history: [{
      at: new Date(),
      by: access.adminId,
      action: 'created',
      to: 'pending',
      note: 'Task created',
    }],
  });

  if (assignedTo) {
    await notifyAdmins([assignedTo], {
      type: 'task_assigned',
      title: 'New task assigned',
      body: `${task.title} · ${order.orderNumber}`,
      order: order._id,
      orderNumber: order.orderNumber,
      task: task._id,
    }).catch(() => {});
  }

  await logAdminAudit({
    access,
    req,
    action: 'ops.task_create',
    targetType: 'OpsTask',
    targetId: String(task._id),
    details: { orderNumber: order.orderNumber, type: task.type },
  });

  return NextResponse.json({ task }, { status: 201 });
}

export async function PATCH(req) {
  let { error, access } = await requireAdminPermission('operations', 'write');
  if (error) {
    const fallback = await requireAdminPermission('orders', 'write');
    if (fallback.error) return error;
    access = fallback.access;
  }
  const body = await req.json();
  if (!body.taskId) return NextResponse.json({ error: 'taskId required' }, { status: 400 });
  await dbConnect();
  const task = await OpsTask.findById(body.taskId);
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

  const prev = task.status;
  if (body.status && TASK_STATUSES.includes(body.status)) {
    task.status = body.status;
    if (body.status === 'completed') task.completedAt = new Date();
  }
  if (body.priority && TASK_PRIORITIES.includes(body.priority)) task.priority = body.priority;
  if (body.dueDate !== undefined) task.dueDate = body.dueDate ? new Date(body.dueDate) : undefined;
  if (body.notes !== undefined) task.notes = String(body.notes || '').trim();
  if (body.assignedTo !== undefined) {
    task.assignedTo = body.assignedTo && mongoose.Types.ObjectId.isValid(String(body.assignedTo))
      ? body.assignedTo
      : undefined;
  }
  task.history.push({
    at: new Date(),
    by: access.adminId,
    action: 'updated',
    from: prev,
    to: task.status,
    note: String(body.note || '').trim(),
  });
  await task.save();
  return NextResponse.json({ task });
}
