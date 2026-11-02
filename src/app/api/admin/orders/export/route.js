export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Order from '@/models/Order';
import { logAdminAudit } from '@/lib/adminAccess';
import { streamCsvResponse } from '@/lib/csvExport';
import {
  buildAdminOrderFilter,
  orderCsvFilename,
  orderCsvHeaderLine,
  orderCsvLine,
  parseOrderReportFilters,
} from '@/lib/adminOrderQuery';

export async function GET(req) {
  const { requireAdminPermission } = await import('@/lib/adminAccess');
  const { error, access } = await requireAdminPermission('orders', 'read');
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const parsed = parseOrderReportFilters(searchParams);
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });

  await dbConnect();
  const filter = buildAdminOrderFilter(parsed);
  const filename = orderCsvFilename(parsed);

  await logAdminAudit({
    access,
    req,
    action: 'orders.export',
    targetType: 'orders',
    details: {
      orderId: parsed.orderId || '',
      name: parsed.name || '',
      mobile: parsed.mobile || '',
      status: parsed.status || '',
      dateFrom: parsed.dateFrom || '',
      dateTo: parsed.dateTo || '',
    },
  });

  return streamCsvResponse(filename, async (write) => {
    write(orderCsvHeaderLine());
    const cursor = Order.find(filter).sort({ createdAt: -1 }).select('-metaAttribution').lean().cursor();
    for await (const order of cursor) {
      write(orderCsvLine(order));
    }
  });
}
