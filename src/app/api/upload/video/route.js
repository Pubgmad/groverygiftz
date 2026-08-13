import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { saveUploadFile } from '@/lib/uploadStorage';

const MAX_VIDEO_SIZE = 100 * 1024 * 1024;
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.type !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get('file');
  if (!file) return NextResponse.json({ error: 'No video uploaded' }, { status: 400 });
  if (!ALLOWED_VIDEO_TYPES.includes(file.type)) return NextResponse.json({ error: 'Only MP4, WEBM or MOV videos are allowed' }, { status: 400 });
  if (file.size > MAX_VIDEO_SIZE) return NextResponse.json({ error: 'Video must be 100 MB or less' }, { status: 400 });

  const stored = await saveUploadFile(file, 'uploads/videos');
  return NextResponse.json({ url: stored.url, name: file.name }, { status: 201 });
}
