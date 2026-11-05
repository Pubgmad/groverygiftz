import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Role from '@/models/Role';
import Admin from '@/models/Admin';
import { logAdminAudit, requirePrimaryAdmin } from '@/lib/adminAccess';
import { normalizePermissions, normalizeRoleName, roleSlugFromName } from '@/lib/adminPermissions';
import { normalizeDataVisibility } from '@/lib/adminPermissionCatalog';

export const dynamic = 'force-dynamic';

const validId = (value) => /^[a-fA-F0-9]{24}$/.test(String(value || ''));

export async function PUT(req, { params }) {
  const { error, access } = await requirePrimaryAdmin();
  if (error) return error;
  const { id } = await params;
  if (!validId(id)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  await dbConnect();
  const role = await Role.findById(id);
  if (!role) return NextResponse.json({ error: 'Role not found' }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const next = {};
  if (body.name !== undefined) {
    const name = normalizeRoleName(body.name);
    const slug = roleSlugFromName(name);
    if (!name || !slug) return NextResponse.json({ error: 'Enter a role name' }, { status: 400 });
    const clash = await Role.findOne({ _id: { $ne: role._id }, $or: [{ slug }, { name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } }] });
    if (clash) return NextResponse.json({ error: 'A role with this name already exists' }, { status: 409 });
    next.name = name;
    next.slug = slug;
  }
  if (body.description !== undefined) next.description = String(body.description || '').trim().slice(0, 300);
  if (body.isActive !== undefined) next.isActive = body.isActive !== false;
  if (body.permissions !== undefined) next.permissions = normalizePermissions(body.permissions, { expandActions: true });
  if (body.dataVisibility !== undefined) next.dataVisibility = normalizeDataVisibility(body.dataVisibility, 'assigned');
  next.updatedBy = access.adminId;
  const updated = await Role.findByIdAndUpdate(id, { $set: next }, { new: true });
  await logAdminAudit({
    access,
    req,
    action: 'role.update',
    targetType: 'role',
    targetId: id,
    details: {
      name: updated.name,
      isActive: updated.isActive,
      dataVisibility: updated.dataVisibility,
      permissions: normalizePermissions(updated.permissions, { expandActions: true }),
    },
  });
  return NextResponse.json({
    role: {
      ...updated.toObject(),
      dataVisibility: normalizeDataVisibility(updated.dataVisibility, 'assigned'),
      permissions: normalizePermissions(updated.permissions, { expandActions: true }),
    },
  });
}

export async function DELETE(req, { params }) {
  const { error, access } = await requirePrimaryAdmin();
  if (error) return error;
  const { id } = await params;
  if (!validId(id)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  await dbConnect();
  const assigned = await Admin.countDocuments({ roleId: id, isActive: { $ne: false } });
  if (assigned > 0) return NextResponse.json({ error: 'Revoke this role from assigned users before deleting it' }, { status: 409 });
  const role = await Role.findByIdAndDelete(id);
  if (!role) return NextResponse.json({ error: 'Role not found' }, { status: 404 });
  await Admin.updateMany({ roleId: id }, { $set: { roleId: null, isActive: false } });
  await logAdminAudit({ access, req, action: 'role.delete', targetType: 'role', targetId: id, details: { name: role.name } });
  return NextResponse.json({ success: true });
}
