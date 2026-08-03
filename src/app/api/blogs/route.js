import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import dbConnect from '@/lib/db';
import Blog from '@/models/Blog';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import slugify from 'slugify';

export async function GET() {
  await dbConnect();
  const blogs = await Blog.find().sort({ createdAt: -1 }).lean();
  return NextResponse.json({ blogs });
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.type !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();
  const body = await req.json();
  body.slug = slugify(body.title, { lower: true, strict: true });
  const blog = await Blog.create(body);
  revalidatePath('/', 'layout');
  revalidatePath('/blogs');
  revalidatePath(`/blogs/${blog.slug}`);
  return NextResponse.json(blog, { status: 201 });
}
