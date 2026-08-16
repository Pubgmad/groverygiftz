export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Order from '@/models/Order';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(req) {
  await dbConnect();
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req?.url || 'http://localhost', 'http://localhost');
  const customerId = searchParams.get('customerId');
  const status = searchParams.get('status');
  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');
  const page = Number(searchParams.get('page')) || 1;
  const limit = 20;

  const filter = { paymentStatus: 'paid' };
  if (session.user.type === 'admin') {
    if (customerId) filter.customer = customerId;
  } else {
    const email = String(session.user.email || '').trim().toLowerCase();
    filter.$or = [
      { customer: session.user.id },
      ...(email ? [
        { guestEmail: email },
        { 'shippingAddress.email': email },
      ] : []),
    ];
  }
  if (status) filter.status = status;
  if (dateFrom || dateTo) {
    filter.paidAt = {};
    if (dateFrom) filter.paidAt.$gte = new Date(dateFrom + 'T00:00:00.000+05:30');
    if (dateTo) filter.paidAt.$lte = new Date(dateTo + 'T23:59:59.999+05:30');
  }

  const [orders, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Order.countDocuments(filter),
  ]);

  return NextResponse.json({ orders, total, pages: Math.ceil(total / limit) });
}

export async function POST() {
  return NextResponse.json({ error: 'Offline payment is disabled. Please use secure online payment.' }, { status: 405 });
}
