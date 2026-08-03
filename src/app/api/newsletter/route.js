import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Newsletter from '@/models/Newsletter';

export async function GET() {
  await dbConnect();
  const subscribers = await Newsletter.find().sort({ createdAt: -1 }).lean();
  return NextResponse.json({ subscribers });
}

export async function POST(req) {
  await dbConnect();
  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 });

  const existing = await Newsletter.findOne({ email });
  if (existing) return NextResponse.json({ message: 'Already subscribed' });

  await Newsletter.create({ email });
  return NextResponse.json({ message: 'Subscribed successfully' }, { status: 201 });
}
