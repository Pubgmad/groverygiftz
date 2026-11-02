import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import dbConnect from '@/lib/db';
import Page from '@/models/Page';
import { requireAdminPermission } from '@/lib/adminAccess';

export async function GET(req, { params }) {
  const { error } = await requireAdminPermission('pages', 'read');
  if (error) return error;
  await dbConnect();
  const page = await Page.findById(params.id).lean();
  if (!page) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(page);
}

export async function PUT(req, { params }) {
  const { error } = await requireAdminPermission('pages', 'write');
  if (error) return error;

  await dbConnect();
  const body = await req.json();
  const page = await Page.findByIdAndUpdate(params.id, body, { new: true });
  if (!page) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  revalidatePath('/', 'layout');
  if (page.slug) revalidatePath(`/policies/${page.slug}`);
  return NextResponse.json(page);
}

export async function DELETE(req, { params }) {
  const { error } = await requireAdminPermission('pages', 'write');
  if (error) return error;

  await dbConnect();
  const deleted = await Page.findByIdAndDelete(params.id);
  revalidatePath('/', 'layout');
  if (deleted?.slug) revalidatePath(`/policies/${deleted.slug}`);
  return NextResponse.json({ success: true });
}
