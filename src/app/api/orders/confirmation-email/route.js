import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/db';
import Order from '@/models/Order';
import { confirmationEmailStateForOrder } from '@/lib/orderConfirmationOutbox';
import { confirmationRecipientEmail } from '@/lib/orderConfirmationSchedule';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (session?.user?.type !== 'customer') {
    return NextResponse.json({ error: 'Please sign in to view this order.' }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const cashfreeOrderId = String(searchParams.get('cashfreeOrderId') || '').trim();
  const orderNumber = String(searchParams.get('orderNumber') || '').trim();
  if (!cashfreeOrderId && !orderNumber) {
    return NextResponse.json({ error: 'Missing order' }, { status: 400 });
  }

  await dbConnect();
  const filter = { customer: session.user.id };
  if (cashfreeOrderId) filter.cashfreeOrderId = cashfreeOrderId;
  if (orderNumber) filter.orderNumber = orderNumber;
  const order = await Order.findOne(filter).select('_id guestEmail shippingAddress confirmationSchedule').lean();
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  const state = await confirmationEmailStateForOrder(order._id);
  return NextResponse.json({
    to: state.to || confirmationRecipientEmail(order),
    status: state.status,
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}
