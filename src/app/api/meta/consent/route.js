import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/db';
import Order from '@/models/Order';

export async function POST(req) {
  const origin = req.headers.get('origin');
  const allowedOrigins = [new URL(req.url).origin];
  try { if (process.env.NEXTAUTH_URL) allowedOrigins.push(new URL(process.env.NEXTAUTH_URL).origin); } catch {}
  if (!origin || !allowedOrigins.includes(origin)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.type === 'customer' && session.user.id) {
      await dbConnect();
      await Order.updateMany(
        { customer: session.user.id, metaConversionPurchaseSentAt: null, 'metaAttribution.allowed': true },
        {
          $set: { 'metaAttribution.allowed': false },
          $unset: { 'metaAttribution.fbc': '', 'metaAttribution.fbp': '', 'metaAttribution.clientUserAgent': '', 'metaAttribution.clientIpAddress': '', metaConversionPurchaseStartedAt: '' },
        }
      );
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Unable to update marketing preferences' }, { status: 503 });
  }
}
