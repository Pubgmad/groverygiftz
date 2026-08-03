import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Settings from '@/models/Settings';
import Order from '@/models/Order';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const CASHFREE_VERSION = '2025-01-01';
const endpointFor = (environment) => environment === 'production'
  ? 'https://api.cashfree.com/pg/orders'
  : 'https://sandbox.cashfree.com/pg/orders';

const isTamilNadu = (state) => String(state || '').trim().toLowerCase() === 'tamil nadu';

export async function POST(req) {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);
    if (!session || session.user.type !== 'customer') {
      return NextResponse.json({ error: 'Please sign in as a customer before placing an order.' }, { status: 401 });
    }

    const settings = await Settings.findOne().lean();
    if (!settings?.cashfreeEnabled || !settings?.cashfreeAppId || !settings?.cashfreeSecretKey) {
      return NextResponse.json({ error: 'Cashfree payment is not configured yet' }, { status: 503 });
    }

    const body = await req.json();
    const { items, shippingAddress, notes } = body;
    if (!items?.length || !shippingAddress) {
      return NextResponse.json({ error: 'Missing required order fields' }, { status: 400 });
    }

    const subtotal = items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0);
    const shippingCost = isTamilNadu(shippingAddress.state)
      ? Number(settings.tamilNaduShippingCost ?? 0)
      : Number(settings.otherStateShippingCost ?? settings.shippingCost ?? 0);
    const total = subtotal + shippingCost;

    const pendingOrderNumber = 'PENDING-' + Date.now().toString(36).toUpperCase();
    const origin = req.headers.get('origin') || process.env.NEXTAUTH_URL || 'http://localhost:3000';

    const cashfreeRes = await fetch(endpointFor(settings.cashfreeEnvironment), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-version': CASHFREE_VERSION,
        'x-client-id': settings.cashfreeAppId,
        'x-client-secret': settings.cashfreeSecretKey,
        'x-idempotency-key': pendingOrderNumber,
      },
      body: JSON.stringify({
        order_id: pendingOrderNumber,
        order_amount: Number(total),
        order_currency: 'INR',
        order_note: notes || 'GroveryGiftz order',
        customer_details: {
          customer_id: session.user.id,
          customer_name: shippingAddress.fullName,
          customer_email: shippingAddress.email || session.user.email,
          customer_phone: shippingAddress.phone,
        },
        order_meta: {
          return_url: `${origin}/checkout?cashfree_order_id={order_id}`,
        },
      }),
    });

    const cashfreeData = await cashfreeRes.json();
    if (!cashfreeRes.ok) {
      return NextResponse.json({ error: cashfreeData.message || 'Failed to create Cashfree order' }, { status: cashfreeRes.status });
    }

    const order = await Order.create({
      orderNumber: pendingOrderNumber,
      customer: session.user.id,
      guestEmail: shippingAddress?.email || session.user.email || null,
      items,
      shippingAddress,
      subtotal,
      shippingCost,
      total,
      deliveryEstimate: isTamilNadu(shippingAddress.state)
        ? settings.tamilNaduDeliveryEstimate || 'Within 8 days'
        : settings.otherStateDeliveryEstimate || '10-15 days',
      isOutOfTamilNadu: !isTamilNadu(shippingAddress.state),
      paymentMethod: 'Cashfree',
      paymentStatus: 'pending',
      cashfreeOrderId: cashfreeData.order_id,
      cashfreeCfOrderId: String(cashfreeData.cf_order_id || ''),
      cashfreePaymentSessionId: cashfreeData.payment_session_id,
      notes: notes || '',
    });

    return NextResponse.json({
      orderNumber: pendingOrderNumber,
      dbOrderId: order._id.toString(),
      cashfreeOrderId: cashfreeData.order_id,
      paymentSessionId: cashfreeData.payment_session_id,
      shippingCost,
      total,
      deliveryEstimate: order.deliveryEstimate,
      mode: settings.cashfreeEnvironment === 'production' ? 'production' : 'sandbox',
    }, { status: 201 });
  } catch (error) {
    console.error('Cashfree create order error:', error);
    return NextResponse.json({ error: 'Failed to create Cashfree order' }, { status: 500 });
  }
}
