import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Settings from '@/models/Settings';
import Order from '@/models/Order';
import { getNextPaidOrderNumber, isFinalOrderNumber } from '@/lib/orderNumbers';

const CASHFREE_VERSION = '2025-01-01';
const endpointFor = (environment, orderId) => environment === 'production'
  ? `https://api.cashfree.com/pg/orders/${encodeURIComponent(orderId)}`
  : `https://sandbox.cashfree.com/pg/orders/${encodeURIComponent(orderId)}`;

export async function POST(req) {
  try {
    await dbConnect();
    const settings = await Settings.findOne().lean();
    const { orderId } = await req.json();
    if (!orderId) return NextResponse.json({ error: 'Missing Cashfree order ID' }, { status: 400 });
    if (!settings?.cashfreeAppId || !settings?.cashfreeSecretKey) {
      return NextResponse.json({ error: 'Cashfree payment is not configured yet' }, { status: 503 });
    }

    const cashfreeRes = await fetch(endpointFor(settings.cashfreeEnvironment, orderId), {
      headers: {
        'x-api-version': CASHFREE_VERSION,
        'x-client-id': settings.cashfreeAppId,
        'x-client-secret': settings.cashfreeSecretKey,
      },
    });
    const data = await cashfreeRes.json();
    if (!cashfreeRes.ok) {
      return NextResponse.json({ error: data.message || 'Unable to verify Cashfree order' }, { status: cashfreeRes.status });
    }

    const paid = data.order_status === 'PAID';
    const order = await Order.findOne({ cashfreeOrderId: orderId });
    if (!order) return NextResponse.json({ error: 'Store order not found' }, { status: 404 });

    order.paymentStatus = paid ? 'paid' : 'pending';
    order.status = paid ? 'ordered' : 'pending';
    if (paid && !order.paidAt) order.paidAt = new Date();
    order.cashfreeCfOrderId = String(data.cf_order_id || '');
    if (paid && !isFinalOrderNumber(order.orderNumber)) {
      order.orderNumber = await getNextPaidOrderNumber();
    }
    await order.save();

    return NextResponse.json({
      success: paid,
      paymentStatus: order.paymentStatus,
      orderNumber: order.orderNumber,
      deliveryEstimate: order.deliveryEstimate,
      shippingCost: order.shippingCost,
      total: order.total,
    });
  } catch (error) {
    console.error('Cashfree verify error:', error);
    return NextResponse.json({ error: 'Payment verification failed' }, { status: 500 });
  }
}
