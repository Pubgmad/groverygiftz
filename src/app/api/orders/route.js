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
  const page = Number(searchParams.get('page')) || 1;
  const limit = 20;

  const filter = {};
  if (session.user.type === 'admin') {
    if (customerId) filter.customer = customerId;
  } else {
    filter.customer = session.user.id;
  }
  if (status) filter.status = status;

  const [orders, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Order.countDocuments(filter),
  ]);

  return NextResponse.json({ orders, total, pages: Math.ceil(total / limit) });
}

export async function POST() {
  return NextResponse.json({ error: 'Offline payment is disabled. Please use secure online payment.' }, { status: 405 });
}
