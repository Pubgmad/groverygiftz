export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/db';
import Settings from '@/models/Settings';
import { DELIVERY_ESTIMATE_KEYS, validateDeliveryEstimate } from '@/lib/centralDeliveryEstimates';
import { readDeliveryEstimateSettings } from '@/lib/deliveryEstimateSettings';

const response = (settings) => NextResponse.json(Object.fromEntries(DELIVERY_ESTIMATE_KEYS.map((key) => [key, settings[key]])), { headers: { 'Cache-Control': 'no-store' } });

export async function GET() {
  try {
    await dbConnect();
    return response(await readDeliveryEstimateSettings());
  } catch {
    return NextResponse.json({ error: 'Unable to load estimated delivery days' }, { status: 503 });
  }
}

export async function PUT(req) {
  const session = await getServerSession(authOptions);
  if (session?.user?.type !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const values = Object.fromEntries(DELIVERY_ESTIMATE_KEYS.map((key) => [key, validateDeliveryEstimate(body?.[key])]));
    if (DELIVERY_ESTIMATE_KEYS.some((key) => !values[key])) return NextResponse.json({ error: 'Enter positive delivery days or a valid range, up to 365 days (for example, 3-4 working days).' }, { status: 400 });
    await dbConnect();
    const settings = await Settings.findOneAndUpdate({}, { $set: values }, { new: true, upsert: true, runValidators: true });
    revalidatePath('/', 'layout');
    return response(settings);
  } catch {
    return NextResponse.json({ error: 'Unable to save estimated delivery days. Please retry.' }, { status: 503 });
  }
}
