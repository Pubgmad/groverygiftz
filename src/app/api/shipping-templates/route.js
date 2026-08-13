export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import ShippingTemplate from '@/models/ShippingTemplate';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sanitizeShippingTemplatePayload } from '@/lib/shippingTemplatePayload';

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  return session?.user?.type === 'admin';
}

export async function GET(req) {
  await dbConnect();
  const { searchParams } = new URL(req?.url || 'http://localhost', 'http://localhost');
  const includeAll = searchParams.get('all') === 'true';
  const filter = includeAll ? {} : { isActive: true };
  const templates = await ShippingTemplate.find(filter).sort({ createdAt: -1 }).lean();
  return NextResponse.json({ templates });
}

export async function POST(req) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await dbConnect();
  const body = sanitizeShippingTemplatePayload(await req.json());
  if (!String(body.name || '').trim()) return NextResponse.json({ error: 'Template name is required' }, { status: 400 });
  const template = await ShippingTemplate.create(body);
  return NextResponse.json(template, { status: 201 });
}