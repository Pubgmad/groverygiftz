import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Banner from '@/models/Banner';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function PUT(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.type !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();
  const body = await req.json();
  const banner = await Banner.findByIdAndUpdate(params.id, body, { new: true });
  if (!banner) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(banner);
}

export async function DELETE(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.type !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();
  await Banner.findByIdAndDelete(params.id);
  return NextResponse.json({ success: true });
}
