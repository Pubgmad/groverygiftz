import { NextResponse } from 'next/server';
import { CashfreeFinalizeError, finalizeCashfreeOrder } from '@/lib/cashfreeOrderFinalization';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { refreshMetaVerificationAttribution } from '@/lib/metaAttributionServer';
import dbConnect from '@/lib/db';
import Order from '@/models/Order';

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.type !== 'customer') return NextResponse.json({ error: 'Please sign in to view this order.' }, { status: 401 });
    const { orderId } = await req.json();
    if (typeof orderId !== 'string' || !/^[a-zA-Z0-9_-]{1,200}$/.test(orderId)) return NextResponse.json({ error: 'Invalid Cashfree order ID' }, { status: 400 });
    await dbConnect();
    const ownedOrder = await Order.findOne({ cashfreeOrderId: orderId, customer: session.user.id }).select('_id').lean();
    if (!ownedOrder) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    try {
      await refreshMetaVerificationAttribution(req, orderId, session.user.id);
    } catch {
      console.error('Meta browser attribution refresh failed');
    }
    const result = await finalizeCashfreeOrder(orderId);
    return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Cashfree verify error:', error);
    if (error instanceof CashfreeFinalizeError) {
      return NextResponse.json({ error: error.message, retryable: error.retryable === true }, { status: error.status });
    }
    return NextResponse.json({ error: 'Payment verification failed' }, { status: 500 });
  }
}
