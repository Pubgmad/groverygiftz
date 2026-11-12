import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import dbConnect from '@/lib/db';
import Blog from '@/models/Blog';
import { requireAdminPermission } from '@/lib/adminAccess';
import slugify from 'slugify';

export async function GET() {
  const { error } = await requireAdminPermission('blogs', 'read');
  if (error) return error;
  await dbConnect();
  const blogs = await Blog.find().select('title slug excerpt featuredImage author isPublished tags createdAt updatedAt').sort({ createdAt: -1 }).lean();
  return NextResponse.json({ blogs });
}

export async function POST(req) {
  const { error } = await requireAdminPermission('blogs', 'write');
  if (error) return error;

  await dbConnect();
  const body = await req.json();
  body.slug = slugify(body.title, { lower: true, strict: true });
  const blog = await Blog.create(body);
  revalidatePath('/', 'layout');
  revalidatePath('/blogs');
  revalidatePath(`/blogs/${blog.slug}`);
  return NextResponse.json(blog, { status: 201 });
}
