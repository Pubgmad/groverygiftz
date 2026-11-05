export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { requireAdminPermission } from '@/lib/adminAccess';
import { listActiveEditors, getEditorWorkloads } from '@/lib/editorAssignment';

/** Super Admin / orders read: active Editors + pending editing workloads. */
export async function GET() {
  const { error } = await requireAdminPermission('orders', 'read');
  if (error) return error;
  await dbConnect();
  const editors = await listActiveEditors();
  const workloads = await getEditorWorkloads(editors.map((e) => e._id));
  return NextResponse.json({
    editors: editors.map((e) => ({
      _id: e._id,
      name: e.name || e.email || '',
      email: e.email || '',
      pendingEditing: workloads[String(e._id)] || 0,
    })),
  });
}
