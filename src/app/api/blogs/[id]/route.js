import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import dbConnect from '@/lib/db';
import Blog from '@/models/Blog';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import slugify from 'slugify';

export async function GET(req, { params }) {
  await dbConnect();
  const blog = await Blog.findById(params.id).lean();
  if (!blog) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(blog);
}

export async function PUT(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.type !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
  const session = await getServerSession(authOptions);
  if (!session || session.user.type !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();
  const deleted = await Blog.findByIdAndDelete(params.id);
  revalidatePath('/', 'layout');
  revalidatePath('/blogs');
  if (deleted?.slug) revalidatePath(`/blogs/${deleted.slug}`);
  return NextResponse.json({ success: true });
}
