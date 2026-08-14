import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Settings from '@/models/Settings';
import Order from '@/models/Order';
import Product from '@/models/Product';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { buildDeliveryEstimateText } from '@/lib/deliveryDate';
import { assertStockAvailable, getGroupedStockRequests } from '@/lib/inventory';
import { getCashfreeConfig } from '@/lib/cashfreeConfig';

const CASHFREE_VERSION = '2025-01-01';
const endpointFor = (environment) => environment === 'production'
  ? 'https://api.cashfree.com/pg/orders'
  : 'https://sandbox.cashfree.com/pg/orders';

const isTamilNadu = (state) => String(state || '').trim().toLowerCase() === 'tamil nadu';

const getStateOverride = (delivery, state) => (delivery?.stateOverrides || []).find(
  (row) => String(row.state || '').trim().toLowerCase() === String(state || '').trim().toLowerCase()
);

const resolveItemDelivery = (item, productsById, state, settings) => {
  const variantOverride = getStateOverride(item?.variantDelivery, state);
  if (variantOverride?.state) return { cost: Number(variantOverride.shippingCost || 0), estimate: variantOverride.deliveryEstimate || '' };
  const product = productsById[String(item.productId || item.product || '')];
  const delivery = product?.delivery || item.delivery || {};
  if (!delivery.useCustomDelivery) return null;

  const override = getStateOverride(delivery, state);
  if (override?.state) return { cost: Number(override.shippingCost || 0), estimate: override.deliveryEstimate || '' };

  if (isTamilNadu(state)) {
    return {
      cost: Number(delivery.tamilNaduShippingCost || 0),
      estimate: delivery.tamilNaduDeliveryEstimate || settings.tamilNaduDeliveryEstimate || 'Within 8 days',
    };
  }

  return {
    cost: Number(delivery.otherStateShippingCost || 0),
    estimate: delivery.otherStateDeliveryEstimate || settings.otherStateDeliveryEstimate || '10-15 days',
  };
};

const calculateShipping = (items, productsById, state, settings) => {
  if (!state) return { cost: 0, estimate: 'Select state to see delivery estimate' };

  let cost = 0;
  let hasStoreDefaultItem = false;
  const estimates = [];

  items.forEach((item) => {
    const resolved = resolveItemDelivery(item, productsById, state, settings);
    if (resolved) {
      cost += resolved.cost * Number(item.quantity || 1);
      if (resolved.estimate) estimates.push(resolved.estimate);
      return;
    }
    hasStoreDefaultItem = true;
  });

  if (hasStoreDefaultItem) {
    cost += isTamilNadu(state) ? Number(settings.tamilNaduShippingCost || 0) : Number(settings.otherStateShippingCost || 0);
    estimates.push(isTamilNadu(state) ? settings.tamilNaduDeliveryEstimate : settings.otherStateDeliveryEstimate);
  }

  const uniqueEstimates = [...new Set(estimates.filter(Boolean))];
  return {
    cost,
    estimate: buildDeliveryEstimateText(uniqueEstimates.length > 1 ? uniqueEstimates.join(' / ') : (uniqueEstimates[0] || (isTamilNadu(state) ? 'Within 8 days' : '10-15 days')), { fallbackDays: isTamilNadu(state) ? 8 : 15 }),
  };
};

export async function POST(req) {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);
    if (!session || session.user.type !== 'customer') {
      return NextResponse.json({ error: 'Please sign in as a customer before placing an order.' }, { status: 401 });
    }

    const settings = await Settings.findOne().lean();
    const cashfree = getCashfreeConfig(settings);
    if (!cashfree.enabled || !cashfree.appId || !cashfree.secretKey) {
      return NextResponse.json({ error: 'Cashfree payment is not configured yet' }, { status: 503 });
    }

    const body = await req.json();
    const { items, shippingAddress, notes } = body;
    if (!items?.length || !shippingAddress) {
      return NextResponse.json({ error: 'Missing required order fields' }, { status: 400 });
    }

    const orderItems = items.map((item) => ({ ...item, product: item.product || item.productId || undefined, productId: item.productId || item.product || '' }));
    const productIds = [...new Set(orderItems.map((item) => item.productId).filter(Boolean))];
    const products = await Product.find({ _id: { $in: productIds } }).select('title stock variants delivery isActive').lean();
    const productsById = Object.fromEntries(products.map((product) => [String(product._id), product]));
    assertStockAvailable(getGroupedStockRequests(orderItems, productsById));
    const subtotal = orderItems.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0);
    const shipping = calculateShipping(orderItems, productsById, shippingAddress.state, settings);
    const shippingCost = shipping.cost;
    const total = subtotal + shippingCost;

    const pendingOrderNumber = 'PENDING-' + Date.now().toString(36).toUpperCase();
    const origin = req.headers.get('origin') || process.env.NEXTAUTH_URL || 'http://localhost:3000';

    const cashfreeRes = await fetch(endpointFor(cashfree.environment), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-version': CASHFREE_VERSION,
        'x-client-id': cashfree.appId,
        'x-client-secret': cashfree.secretKey,
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
          customer_phone: shippingAddress.whatsappNumber || shippingAddress.phone,
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
      items: orderItems,
      shippingAddress,
      subtotal,
      shippingCost,
      total,
      deliveryEstimate: shipping.estimate,
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
      mode: cashfree.environment === 'production' ? 'production' : 'sandbox',
    }, { status: 201 });
  } catch (error) {
    if (error?.name === 'InventoryError') {
      return NextResponse.json({ error: error.message }, { status: error.status || 409 });
    }
    console.error('Cashfree create order error:', error);
    return NextResponse.json({ error: 'Failed to create Cashfree order' }, { status: 500 });
  }
}
