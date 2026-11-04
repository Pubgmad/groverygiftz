export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Order from '@/models/Order';
import Settings from '@/models/Settings';
import { logAdminAudit } from '@/lib/adminAccess';
import {
  buildShippingLabelPayload,
  MAX_SHIPPING_LABEL_ORDERS,
  parseOrderObjectIds,
} from '@/lib/shippingLabelData';
import { buildShippingLabelsPdf, shippingLabelFilename } from '@/lib/shippingLabelPdf';

function requestOrigin(req) {
  try {
    return new URL(process.env.NEXTAUTH_URL || req.url).origin;
  } catch {
    return 'https://groverygiftz.in';
  }
}

function publicValidationPayload(payload) {
  return {
    layout: payload.layout,
    company: {
      siteName: payload.company.siteName,
      tradeName: payload.company.tradeName,
      hasReturnAddress: Boolean(payload.company.returnAddress),
      hasPhone: Boolean(payload.company.phone),
    },
    valid: payload.valid.map(({ token, trackUrl, ...rest }) => rest),
    invalid: payload.invalid,
    pageCount: payload.pageCount,
    validCount: payload.valid.length,
    invalidCount: payload.invalid.length,
    maxOrders: payload.maxOrders,
  };
}

async function loadLabelContext(req) {
  const body = await req.json().catch(() => ({}));
  const orderIds = Array.isArray(body.orderIds) ? body.orderIds : [];
  const layout = body.layout || 'four';
  const generatePdf = body.generatePdf === true || body.mode === 'pdf';
  const confirmPartial = body.confirmPartial === true;

  if (!orderIds.length) {
    return { error: NextResponse.json({ error: 'Select at least one order' }, { status: 400 }) };
  }
  if (orderIds.length > MAX_SHIPPING_LABEL_ORDERS) {
    return {
      error: NextResponse.json({
        error: `You can generate labels for at most ${MAX_SHIPPING_LABEL_ORDERS} orders at a time`,
      }, { status: 400 }),
    };
  }

  const objectIds = parseOrderObjectIds(orderIds);
  if (!objectIds.length) {
    return { error: NextResponse.json({ error: 'No valid order IDs provided' }, { status: 400 }) };
  }

  await dbConnect();
  const [orders, settings] = await Promise.all([
    Order.find({ _id: { $in: objectIds } })
      .select('orderNumber status paymentStatus paidAt createdAt shippingAddress items deliveryEstimate')
      .lean(),
    Settings.findOne()
      .select('siteName tradeName logo desktopLogo address phone email')
      .lean(),
  ]);

  const origin = requestOrigin(req);
  const payload = buildShippingLabelPayload({
    orders,
    settings: settings || {},
    layoutInput: layout,
    origin,
    requestedIds: objectIds.map(String),
  });

  if (payload.valid.some((row) => !row.trackUrl || !row.token)) {
    return {
      error: NextResponse.json({
        error: 'Shipping label tracking tokens require NEXTAUTH_SECRET to be configured on the server.',
      }, { status: 500 }),
    };
  }

  return { payload, generatePdf, confirmPartial, layout, origin, body };
}

export async function POST(req) {
  const { requireAdminPermission } = await import('@/lib/adminAccess');
  const { error, access } = await requireAdminPermission('orders', 'read');
  if (error) return error;

  try {
    const loaded = await loadLabelContext(req);
    if (loaded.error) return loaded.error;
    const { payload, generatePdf, confirmPartial } = loaded;

    if (!generatePdf) {
      return NextResponse.json(publicValidationPayload(payload), { headers: { 'Cache-Control': 'no-store' } });
    }

    if (!payload.valid.length) {
      return NextResponse.json({
        error: 'No eligible orders to print',
        invalid: payload.invalid,
        validCount: 0,
        invalidCount: payload.invalid.length,
      }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
    }

    if (payload.invalid.length && !confirmPartial) {
      return NextResponse.json({
        error: 'Some selected orders are missing required shipping information',
        requiresConfirmation: true,
        ...publicValidationPayload(payload),
      }, { status: 409, headers: { 'Cache-Control': 'no-store' } });
    }

    const pdf = await buildShippingLabelsPdf({
      orders: payload.valid,
      company: payload.company,
      layout: payload.layout,
      origin: loaded.origin,
    });

    await logAdminAudit({
      access,
      req,
      action: 'orders.shipping_labels',
      targetType: 'orders',
      details: {
        layout: payload.layout.id,
        validCount: payload.valid.length,
        invalidCount: payload.invalid.length,
        pageCount: payload.pageCount,
        orderNumbers: payload.valid.map((row) => row.orderNumber),
      },
    });

    const filename = shippingLabelFilename();
    return new NextResponse(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
        'X-Label-Valid-Count': String(payload.valid.length),
        'X-Label-Invalid-Count': String(payload.invalid.length),
        'X-Label-Page-Count': String(payload.pageCount),
        'X-Label-Layout': payload.layout.id,
      },
    });
  } catch (err) {
    console.error('[shipping-labels]', err?.message || err);
    return NextResponse.json(
      { error: 'Unable to generate shipping labels', detail: String(err?.message || err).slice(0, 300) },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
