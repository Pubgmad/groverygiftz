import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const MAX_VIDEO_SIZE = 100 * 1024 * 1024;
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.type !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get('file');
  if (!file) return NextResponse.json({ error: 'No video uploaded' }, { status: 400 });
  if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Only MP4, WEBM or MOV videos are allowed' }, { status: 400 });
  }
  if (file.size > MAX_VIDEO_SIZE) {
    return NextResponse.json({ error: 'Video must be 100 MB or less' }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const originalName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${originalName}`;
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'videos');

  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, filename), buffer);

  return NextResponse.json({ url: `/uploads/videos/${filename}`, name: file.name }, { status: 201 });
}
