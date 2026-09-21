import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { deleteUploadByUrl, saveUploadFile } from '@/lib/uploadStorage';
import { detectImageFormat } from '@/lib/imageFormat';

const MAX_FILE_SIZE = 200 * 1024 * 1024;
const ADMIN_IMAGE_FORMATS = new Set(['jpeg', 'png', 'webp', 'gif', 'svg', 'avif']);

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  return session?.user?.type === 'admin';
}

export async function POST(req) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get('file');
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'Image must be under 200 MB' }, { status: 400 });

    const format = detectImageFormat(Buffer.from(await file.arrayBuffer()));
    if (!format?.isImage || !ADMIN_IMAGE_FORMATS.has(format.format)) return NextResponse.json({ error: 'Only valid JPG, PNG, WEBP, GIF, SVG, or AVIF images are allowed' }, { status: 400 });

    const stored = await saveUploadFile(file, 'uploads');
    return NextResponse.json({ url: stored.url, type: format.mime }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
  }
}

export async function DELETE(req) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { url } = await req.json();
    await deleteUploadByUrl(url || '');
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete image' }, { status: 500 });
  }
}