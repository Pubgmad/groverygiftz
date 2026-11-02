import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Order from '@/models/Order';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { can, getRequestAdminAccess, requireAdminPermission } from '@/lib/adminAccess';

export async function GET(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();
  const order = await Order.findById(params.id).populate('customer', 'name email phone').lean();
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (session.user.type === 'admin') {
    const access = await getRequestAdminAccess(session);
    if (!can(access, 'orders', 'read')) return NextResponse.json({ error: 'You do not have permission to perform this action' }, { status: 403 });
  } else if (order.customer?.toString() !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json(order);
}

export async function PUT(req, { params }) {
  const { error } = await requireAdminPermission('orders', 'write');
  if (error) return error;

  await dbConnect();
  const body = await req.json();
  const order = await Order.findByIdAndUpdate(params.id, body, { new: true });
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(order);
}
