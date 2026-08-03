import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import dbConnect from '@/lib/db';
import Page from '@/models/Page';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(req, { params }) {
  await dbConnect();
  const page = await Page.findById(params.id).lean();
  if (!page) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(page);
}

export async function PUT(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.type !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();
  const body = await req.json();
  const page = await Page.findByIdAndUpdate(params.id, body, { new: true });
  if (!page) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  revalidatePath('/', 'layout');
  if (page.slug) revalidatePath(`/policies/${page.slug}`);
  return NextResponse.json(page);
}

export async function DELETE(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.type !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();
  const deleted = await Page.findByIdAndDelete(params.id);
  revalidatePath('/', 'layout');
  if (deleted?.slug) revalidatePath(`/policies/${deleted.slug}`);
  return NextResponse.json({ success: true });
}
