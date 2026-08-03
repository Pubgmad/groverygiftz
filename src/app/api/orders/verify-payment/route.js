import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ error: 'Razorpay verification is disabled. Please use Cashfree payment.' }, { status: 410 });
}
