import { NextResponse } from 'next/server';
import { CashfreeFinalizeError, finalizeCashfreeOrder } from '@/lib/cashfreeOrderFinalization';
import dbConnect from '@/lib/db';
import Settings from '@/models/Settings';
import { getCashfreeConfig } from '@/lib/cashfreeConfig';
import { verifyCashfreeWebhook } from '@/lib/cashfreeWebhook';

const getWebhookOrderId = (payload) => payload?.data?.order?.order_id || payload?.order?.order_id || payload?.order_id || '';

export async function POST(req) {
  try {
    const rawBody = await req.text();
    await dbConnect();
    const settings = await Settings.findOne().lean();
    const cashfree = getCashfreeConfig(settings);
    if (!cashfree.secretKey) return NextResponse.json({ error: 'Payment configuration unavailable' }, { status: 503 });
    if (!verifyCashfreeWebhook(rawBody, req.headers, cashfree.secretKey)) return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
    const payload = rawBody ? JSON.parse(rawBody) : {};
    const orderId = getWebhookOrderId(payload);
    if (!orderId) return NextResponse.json({ received: true, ignored: true, reason: 'missing_order_id' });

    const result = await finalizeCashfreeOrder(orderId, { retryTracking: true });
    return NextResponse.json({ received: true, orderNumber: result.orderNumber, paymentStatus: result.paymentStatus, success: result.success });
  } catch (error) {
    console.error('Cashfree webhook error:', error);
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid webhook payload' }, { status: 400 });
    }
    if (error instanceof CashfreeFinalizeError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
