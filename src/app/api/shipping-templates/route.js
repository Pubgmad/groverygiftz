export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import ShippingTemplate from '@/models/ShippingTemplate';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sanitizeShippingTemplatePayload } from '@/lib/shippingTemplatePayload';
import { readDeliveryEstimateSettings } from '@/lib/deliveryEstimateSettings';
import { centralizeTemplateRates } from '@/lib/centralDeliveryEstimates';

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
  const deliveryEstimates = await readDeliveryEstimateSettings();
  return NextResponse.json({ templates: templates.map((template) => ({ ...template, rates: centralizeTemplateRates(template.rates, deliveryEstimates) })), deliveryEstimates }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await dbConnect();
  const body = sanitizeShippingTemplatePayload(await req.json());
  body.rates = centralizeTemplateRates(body.rates, await readDeliveryEstimateSettings());
  if (!String(body.name || '').trim()) return NextResponse.json({ error: 'Template name is required' }, { status: 400 });
  const template = await ShippingTemplate.create(body);
  return NextResponse.json(template, { status: 201 });
}
