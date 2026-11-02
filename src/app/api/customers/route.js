import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Customer from '@/models/Customer';

export async function GET() {
  const { requireAdminPermission } = await import('@/lib/adminAccess');
  const { error } = await requireAdminPermission('customers', 'read');
  if (error) return error;

  await dbConnect();
  const customers = await Customer.find().select('-password').sort({ createdAt: -1 }).lean();
  return NextResponse.json({ customers });
}
