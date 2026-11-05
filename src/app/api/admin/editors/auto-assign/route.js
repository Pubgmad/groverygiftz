export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { requireAdminPermission, logAdminAudit } from '@/lib/adminAccess';
import { autoAssignUnassignedEligibleOrders } from '@/lib/editorAssignment';

/**
 * POST: assign active Editors to eligible existing orders that still have no editor.
 * Idempotent for already-assigned orders. Does not reassign manual assignments.
 */
export async function POST(req) {
  const { error, access } = await requireAdminPermission('orders', 'write');
  if (error) return error;

  await dbConnect();
  const body = await req.json().catch(() => ({}));
  const limit = Math.max(1, Math.min(100, Number(body.limit) || 40));

  const results = await autoAssignUnassignedEligibleOrders({
    limit,
    actorId: access.adminId,
    actorName: access.name || access.email || 'Admin',
  });

  await logAdminAudit({
    access,
    req,
    action: 'editors.auto_assign_backfill',
    targetType: 'Order',
    targetId: '',
    details: results,
  });

  return NextResponse.json({ ok: true, ...results });
}
