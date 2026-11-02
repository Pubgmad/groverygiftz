export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Customer from '@/models/Customer';
import { logAdminAudit } from '@/lib/adminAccess';
import { streamCsvResponse } from '@/lib/csvExport';
import {
  customerCsvFilename,
  customerCsvHeaderLine,
  customerCsvLine,
  customerReportPipeline,
  parseCustomerReportFilters,
} from '@/lib/adminCustomerQuery';

export async function GET(req) {
  const { requireAdminPermission } = await import('@/lib/adminAccess');
  const { error, access } = await requireAdminPermission('customers', 'read');
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const parsed = parseCustomerReportFilters(searchParams);
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });

  await dbConnect();
  const filename = customerCsvFilename(parsed);

  await logAdminAudit({
    access,
    req,
    action: 'customers.export',
    targetType: 'customers',
    details: {
      name: parsed.name || '',
      email: parsed.email || '',
      mobile: parsed.mobile || '',
      customerType: parsed.customerType || '',
      dateFrom: parsed.dateFrom || '',
      dateTo: parsed.dateTo || '',
      lastFrom: parsed.lastFrom || '',
      lastTo: parsed.lastTo || '',
    },
  });

  return streamCsvResponse(filename, async (write) => {
    write(customerCsvHeaderLine());
    const cursor = Customer.aggregate(customerReportPipeline(parsed)).allowDiskUse(true).cursor({ batchSize: 50 });
    for await (const row of cursor) {
      write(customerCsvLine(row));
    }
  });
}
