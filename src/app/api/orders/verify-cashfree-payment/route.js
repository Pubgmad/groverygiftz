import { NextResponse } from 'next/server';
import { CashfreeFinalizeError, finalizeCashfreeOrder } from '@/lib/cashfreeOrderFinalization';

export async function POST(req) {
  try {
    const { orderId } = await req.json();
    const result = await finalizeCashfreeOrder(orderId);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Cashfree verify error:', error);
    if (error instanceof CashfreeFinalizeError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Payment verification failed' }, { status: 500 });
  }
}
