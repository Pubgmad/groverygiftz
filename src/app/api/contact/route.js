import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Contact from '@/models/Contact';

export async function GET() {
  const { requireAdminPermission } = await import('@/lib/adminAccess');
  const { error } = await requireAdminPermission('messages', 'read');
  if (error) return error;

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
