import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import dbConnect from '@/lib/db';
import Banner from '@/models/Banner';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(req) {
  await dbConnect();
  const { searchParams } = new URL(req.url);
  const includeAll = searchParams.get('all') === 'true';
  const session = await getServerSession(authOptions);
  const filter = includeAll && session?.user?.type === 'admin' ? {} : { isActive: true };
  const banners = await Banner.find(filter).sort({ order: 1 }).lean();
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
  revalidatePath('/', 'layout');
  revalidatePath('/');
  return NextResponse.json(banner, { status: 201 });
}
