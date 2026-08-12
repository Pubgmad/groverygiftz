import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import ShippingTemplate from '@/models/ShippingTemplate';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  return session?.user?.type === 'admin';
}

export async function PUT(req, { params }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await dbConnect();
  const { id } = await params;
  const body = await req.json();
  const template = await ShippingTemplate.findByIdAndUpdate(id, {
    name: String(body.name || '').trim(),
    description: body.description || '',
    rates: Array.isArray(body.rates) ? body.rates : [],
    isActive: body.isActive !== false,
  }, { new: true });
  if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(template);
}

export async function DELETE(req, { params }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await dbConnect();
  const { id } = await params;
  const deleted = await ShippingTemplate.findByIdAndDelete(id);
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ success: true });
}