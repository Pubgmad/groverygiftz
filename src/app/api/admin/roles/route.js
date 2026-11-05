import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Role from '@/models/Role';
import Admin from '@/models/Admin';
import { logAdminAudit, requirePrimaryAdmin } from '@/lib/adminAccess';
import { normalizePermissions, normalizeRoleName, roleSlugFromName } from '@/lib/adminPermissions';
import { normalizeDataVisibility } from '@/lib/adminPermissionCatalog';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { error, access } = await requirePrimaryAdmin();
  if (error) return error;
  await dbConnect();
  const roles = await Role.find().sort({ createdAt: -1 }).lean();
  const counts = await Admin.aggregate([
    { $match: { roleId: { $ne: null }, isPrimary: { $ne: true } } },
    { $group: { _id: '$roleId', total: { $sum: 1 }, active: { $sum: { $cond: [{ $ne: ['$isActive', false] }, 1, 0] } } } },
  ]);
  const countMap = Object.fromEntries(counts.map((row) => [String(row._id), row]));
  return NextResponse.json({
    roles: roles.map((role) => ({
      ...role,
      permissions: normalizePermissions(role.permissions, { expandActions: true }),
      dataVisibility: normalizeDataVisibility(role.dataVisibility, 'assigned'),
      assignedCount: countMap[String(role._id)]?.total || 0,
      activeAssignedCount: countMap[String(role._id)]?.active || 0,
    })),
    access,
  });
}

export async function POST(req) {
  const { error, access } = await requirePrimaryAdmin();
  if (error) return error;
  await dbConnect();
  const body = await req.json().catch(() => ({}));
  const name = normalizeRoleName(body.name);
  const slug = roleSlugFromName(name);
  if (!name || !slug) return NextResponse.json({ error: 'Enter a role name' }, { status: 400 });
  const description = String(body.description || '').trim().slice(0, 300);
  const permissions = normalizePermissions(body.permissions, { expandActions: true });
  const dataVisibility = normalizeDataVisibility(body.dataVisibility, 'assigned');
  const existing = await Role.findOne({ $or: [{ slug }, { name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } }] });
  if (existing) return NextResponse.json({ error: 'A role with this name already exists' }, { status: 409 });
  const role = await Role.create({
    name,
    slug,
    description,
    isActive: body.isActive !== false,
    permissions,
    dataVisibility,
    createdBy: access.adminId,
    updatedBy: access.adminId,
  });
  await logAdminAudit({ access, req, action: 'role.create', targetType: 'role', targetId: role._id, details: { name, permissions, dataVisibility } });
  return NextResponse.json({ role: { ...role.toObject(), permissions, dataVisibility, assignedCount: 0, activeAssignedCount: 0 } }, { status: 201 });
}
