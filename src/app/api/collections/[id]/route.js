import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import dbConnect from '@/lib/db';
import Collection from '@/models/Collection';
import { requireAdminPermission } from '@/lib/adminAccess';
import slugify from 'slugify';

export async function GET(req, { params }) {
  await dbConnect();
  const collection = await Collection.findById(params.id).lean();
  if (!collection) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(collection);
}

export async function PUT(req, { params }) {
  const { error } = await requireAdminPermission('collections', 'write');
  if (error) return error;

  await dbConnect();
  const body = await req.json();
  if (body.name) body.slug = slugify(body.name, { lower: true, strict: true });
  const collection = await Collection.findByIdAndUpdate(params.id, body, { new: true });
  if (!collection) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  revalidatePath('/', 'layout');
  revalidatePath('/');
  revalidatePath('/shop');
  revalidatePath(`/collections/${collection.slug}`);
  return NextResponse.json(collection);
}

export async function DELETE(req, { params }) {
  const { error } = await requireAdminPermission('collections', 'write');
  if (error) return error;

  await dbConnect();
  const deleted = await Collection.findByIdAndDelete(params.id);
  revalidatePath('/', 'layout');
  revalidatePath('/');
  revalidatePath('/shop');
  if (deleted?.slug) revalidatePath(`/collections/${deleted.slug}`);
  return NextResponse.json({ success: true });
}
