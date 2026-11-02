export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import ShippingTemplate from '@/models/ShippingTemplate';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { can, getRequestAdminAccess, requireAdminPermission } from '@/lib/adminAccess';
import { sanitizeShippingTemplatePayload } from '@/lib/shippingTemplatePayload';
import { readDeliveryEstimateSettings } from '@/lib/deliveryEstimateSettings';
import { centralizeTemplateRates } from '@/lib/centralDeliveryEstimates';

export async function GET(req) {
  await dbConnect();
  const { searchParams } = new URL(req?.url || 'http://localhost', 'http://localhost');
  const session = await getServerSession(authOptions);
  const access = await getRequestAdminAccess(session);
  const includeAll = searchParams.get('all') === 'true' && can(access, 'shipping', 'read');
  const filter = includeAll ? {} : { isActive: true };
  const templates = await ShippingTemplate.find(filter).sort({ createdAt: -1 }).lean();
  const deliveryEstimates = await readDeliveryEstimateSettings();
  return NextResponse.json({ templates: templates.map((template) => ({ ...template, rates: centralizeTemplateRates(template.rates, deliveryEstimates) })), deliveryEstimates }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req) {
  const { error } = await requireAdminPermission('shipping', 'write');
  if (error) return error;
  await dbConnect();
  const body = sanitizeShippingTemplatePayload(await req.json());
  body.rates = centralizeTemplateRates(body.rates, await readDeliveryEstimateSettings());
  if (!String(body.name || '').trim()) return NextResponse.json({ error: 'Template name is required' }, { status: 400 });
  const template = await ShippingTemplate.create(body);
  return NextResponse.json(template, { status: 201 });
}
