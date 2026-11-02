import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import dbConnect from '@/lib/db';
import Blog from '@/models/Blog';
import { requireAdminPermission } from '@/lib/adminAccess';
import slugify from 'slugify';

export async function GET(req, { params }) {
  const { error } = await requireAdminPermission('blogs', 'read');
  if (error) return error;
  await dbConnect();
  const blog = await Blog.findById(params.id).lean();
  if (!blog) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(blog);
}

export async function PUT(req, { params }) {
  const { error } = await requireAdminPermission('blogs', 'write');
  if (error) return error;

  await dbConnect();
  const body = await req.json();
  if (body.title) body.slug = slugify(body.title, { lower: true, strict: true });
  const blog = await Blog.findByIdAndUpdate(params.id, body, { new: true });
  if (!blog) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  revalidatePath('/', 'layout');
  revalidatePath('/blogs');
  revalidatePath(`/blogs/${blog.slug}`);
  return NextResponse.json(blog);
}

export async function DELETE(req, { params }) {
  const { error } = await requireAdminPermission('blogs', 'write');
  if (error) return error;

  await dbConnect();
  const deleted = await Blog.findByIdAndDelete(params.id);
  revalidatePath('/', 'layout');
  revalidatePath('/blogs');
  if (deleted?.slug) revalidatePath(`/blogs/${deleted.slug}`);
  return NextResponse.json({ success: true });
}
