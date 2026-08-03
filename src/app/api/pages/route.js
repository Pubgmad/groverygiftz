import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Page from '@/models/Page';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET() {
  await dbConnect();
  const pages = await Page.find().sort({ type: 1 }).lean();
  return NextResponse.json({ pages });
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.type !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();
  const body = await req.json();
  const page = await Page.create(body);
  return NextResponse.json(page, { status: 201 });
}
