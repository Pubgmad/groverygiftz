import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ error: 'Razorpay is disabled. Please use Cashfree payment.' }, { status: 410 });
}
