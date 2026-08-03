import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Contact from '@/models/Contact';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.type !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();
  const messages = await Contact.find().sort({ createdAt: -1 }).lean();
  return NextResponse.json({ messages });
}

export async function POST(req) {
  await dbConnect();
  const body = await req.json();
  if (!body.name || !body.email || !body.message) {
    return NextResponse.json({ error: 'Name, email, and message are required' }, { status: 400 });
  }

  await Contact.create(body);
  return NextResponse.json({ message: 'Message sent' }, { status: 201 });
}
