export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Admin from '@/models/Admin';
import { requireAdminPermission, isPrimaryAdminRecord } from '@/lib/adminAccess';

/** Lightweight staff directory for assignment dropdowns (orders/operations write). */
export async function GET() {
  const { error } = await requireAdminPermission('orders', 'write');
  if (error) {
    const fallback = await requireAdminPermission('operations', 'write');
    if (fallback.error) return error;
  }
  await dbConnect();
  const staff = await Admin.find({ isActive: { $ne: false } })
    .select('name email isPrimary role isActive')
    .sort({ name: 1 })
    .lean();
  return NextResponse.json({
    staff: staff.map((admin) => ({
      _id: admin._id,
      name: admin.name || admin.email,
      email: admin.email,
      isPrimary: isPrimaryAdminRecord(admin),
    })),
  });
}
