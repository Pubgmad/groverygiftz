export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Customer from '@/models/Customer';
import {
  customerReportPipeline,
  parseCustomerReportFilters,
  shapeCustomerRow,
} from '@/lib/adminCustomerQuery';

export async function GET(req) {
  const { requireAdminPermission } = await import('@/lib/adminAccess');
  const { error } = await requireAdminPermission('customers', 'read');
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const parsed = parseCustomerReportFilters(searchParams);
  if (parsed.error) {
    return NextResponse.json({
      error: parsed.error,
      customers: [],
      total: 0,
      page: parsed.page || 1,
      limit: parsed.limit || 10,
      pages: 0,
    }, { status: 400 });
  }

  await dbConnect();
  const skip = (parsed.page - 1) * parsed.limit;
  const pipeline = customerReportPipeline(parsed, { skip, limit: parsed.limit });
  const results = await Customer.aggregate(pipeline).allowDiskUse(true);
  const facet = results[0] || { meta: [], rows: [] };
  const total = Number(facet.meta?.[0]?.total || 0);
  const customers = (facet.rows || []).map(shapeCustomerRow);

  return NextResponse.json({
    customers,
    total,
    page: parsed.page,
    limit: parsed.limit,
    pages: Math.max(1, Math.ceil(total / parsed.limit)),
  });
}
