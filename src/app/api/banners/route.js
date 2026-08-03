import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Banner from '@/models/Banner';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET() {
  await dbConnect();
  const banners = await Banner.find({ isActive: true }).sort({ order: 1 }).lean();
  return NextResponse.json({ banners });
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.type !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();
  const body = await req.json();
  const banner = await Banner.create(body);
  return NextResponse.json(banner, { status: 201 });
}
