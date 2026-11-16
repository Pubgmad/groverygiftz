export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { requireAdminPermission } from '@/lib/adminAccess';
import { listActiveEditors, peekNextRoundRobinEditor } from '@/lib/editorAssignment';

/** Active Editor-role accounts only (never primary Admin / other roles). */
export async function GET() {
  const { error } = await requireAdminPermission('orders', 'read');
  if (error) return error;
  await dbConnect();
  const editors = await listActiveEditors();
  const proposed = await peekNextRoundRobinEditor();
  return NextResponse.json({
    editors: editors.map((editor) => ({
      _id: editor._id,
      id: editor._id,
      name: editor.name || '',
      email: editor.email || '',
    })),
    proposedEditor: proposed?.editor
      ? {
          _id: proposed.editor._id,
          id: proposed.editor._id,
          name: proposed.editor.name || proposed.editor.email || '',
        }
      : null,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
