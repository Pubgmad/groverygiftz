import { NextResponse } from 'next/server';
import { CashfreeFinalizeError, finalizeCashfreeOrder } from '@/lib/cashfreeOrderFinalization';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { refreshMetaVerificationAttribution } from '@/lib/metaAttributionServer';

export async function POST(req) {
  try {
    const { orderId } = await req.json();
    try {
      const session = await getServerSession(authOptions);
      if (session?.user?.type === 'customer') await refreshMetaVerificationAttribution(req, orderId, session.user.id);
    } catch {
      console.error('Meta browser attribution refresh failed');
    }
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
