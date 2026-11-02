import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import dbConnect from '@/lib/db';
import Page from '@/models/Page';
import { requireAdminPermission } from '@/lib/adminAccess';

export async function GET() {
  const { error } = await requireAdminPermission('pages', 'read');
  if (error) return error;
  await dbConnect();
  const pages = await Page.find().sort({ type: 1 }).lean();
  return NextResponse.json({ pages });
}

export async function POST(req) {
  const { error } = await requireAdminPermission('pages', 'write');
  if (error) return error;

  await dbConnect();
  const body = await req.json();
  const page = await Page.create(body);
  revalidatePath('/', 'layout');
  if (page.slug) revalidatePath(`/policies/${page.slug}`);
  return NextResponse.json(page, { status: 201 });
}
