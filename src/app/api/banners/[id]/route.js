import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import dbConnect from '@/lib/db';
import Banner from '@/models/Banner';
import { requireAdminPermission } from '@/lib/adminAccess';

export async function PUT(req, { params }) {
  const { error } = await requireAdminPermission('banners', 'write');
  if (error) return error;

  await dbConnect();
  const body = await req.json();
  const banner = await Banner.findByIdAndUpdate(params.id, body, { new: true });
  if (!banner) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  revalidatePath('/', 'layout');
  revalidatePath('/');
  return NextResponse.json(banner);
}

export async function DELETE(req, { params }) {
  const { error } = await requireAdminPermission('banners', 'write');
  if (error) return error;

  await dbConnect();
  await Banner.findByIdAndDelete(params.id);
  revalidatePath('/', 'layout');
  revalidatePath('/');
  return NextResponse.json({ success: true });
}
