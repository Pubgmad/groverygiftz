export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Role from '@/models/Role';
import { requirePrimaryAdmin, logAdminAudit } from '@/lib/adminAccess';
import { normalizePermissions } from '@/lib/adminPermissions';
import { OPS_ROLE_PRESETS } from '@/lib/opsRolePresets';

export async function GET() {
  const { error } = await requirePrimaryAdmin();
  if (error) return error;
  return NextResponse.json({ presets: OPS_ROLE_PRESETS });
}

/** Create missing Sales / Editor / Production roles (idempotent). */
export async function POST(req) {
  const { error, access } = await requirePrimaryAdmin();
  if (error) return error;
  await dbConnect();

  const created = [];
  const skipped = [];
  for (const preset of OPS_ROLE_PRESETS) {
    const existing = await Role.findOne({
      $or: [
        { slug: preset.slug },
        { name: { $regex: `^${preset.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } },
      ],
    }).lean();
    if (existing) {
      skipped.push({ name: preset.name, id: String(existing._id) });
      continue;
    }
    const role = await Role.create({
      name: preset.name,
      slug: preset.slug,
      description: preset.description,
      isActive: true,
      permissions: normalizePermissions(preset.permissions),
      createdBy: access.adminId,
      updatedBy: access.adminId,
    });
    created.push({ name: role.name, id: String(role._id) });
  }

  await logAdminAudit({
    access,
    req,
    action: 'role.seed_ops_presets',
    targetType: 'role',
    targetId: 'presets',
    details: { created, skipped },
  });

  return NextResponse.json({ created, skipped }, { status: 201 });
}
