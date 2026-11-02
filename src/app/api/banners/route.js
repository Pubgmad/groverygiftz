export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import dbConnect from '@/lib/db';
import Banner from '@/models/Banner';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { can, getRequestAdminAccess, requireAdminPermission } from '@/lib/adminAccess';

export async function GET(req) {
  await dbConnect();
  const { searchParams } = new URL(req?.url || 'http://localhost', 'http://localhost');
  const includeAll = searchParams.get('all') === 'true';
  const session = await getServerSession(authOptions);
  const access = await getRequestAdminAccess(session);
  const filter = includeAll && can(access, 'banners', 'read') ? {} : { isActive: true };
  const banners = await Banner.find(filter).sort({ order: 1 }).lean();
  return NextResponse.json({ banners });
}

export async function POST(req) {
  const { error } = await requireAdminPermission('banners', 'write');
  if (error) return error;

  await dbConnect();
  const body = await req.json();
  const banner = await Banner.create(body);
  revalidatePath('/', 'layout');
  revalidatePath('/');
  return NextResponse.json(banner, { status: 201 });
}
