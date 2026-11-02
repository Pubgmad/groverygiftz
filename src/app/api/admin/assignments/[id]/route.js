import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import dbConnect from '@/lib/db';
import Admin from '@/models/Admin';
import Role from '@/models/Role';
import { isPrimaryAdminRecord, logAdminAudit, requirePrimaryAdmin } from '@/lib/adminAccess';
import { strongPasswordMessage, validateStrongPassword } from '@/lib/passwordPolicy';

export const dynamic = 'force-dynamic';

const validId = (value) => /^[a-fA-F0-9]{24}$/.test(String(value || ''));

function publicAssignment(admin, role) {
  return {
    _id: admin._id,
    name: admin.name,
    email: admin.email,
    isActive: admin.isActive !== false,
    roleId: admin.roleId,
    roleName: role?.name || '',
    roleActive: role ? role.isActive !== false : false,
    assignedAt: admin.assignedAt || admin.updatedAt,
    createdAt: admin.createdAt,
    accessStatus: admin.isActive === false ? 'revoked' : (!role ? 'unassigned' : (role.isActive === false ? 'role-inactive' : 'active')),
  };
}

export async function PUT(req, { params }) {
  const { error, access } = await requirePrimaryAdmin();
  if (error) return error;
  const { id } = await params;
  if (!validId(id)) return NextResponse.json({ error: 'Invalid assignment' }, { status: 400 });
  await dbConnect();
  const admin = await Admin.findById(id);
  if (!admin) return NextResponse.json({ error: 'Assigned user not found' }, { status: 404 });
  if (isPrimaryAdminRecord(admin)) return NextResponse.json({ error: 'The primary admin cannot be modified here' }, { status: 409 });

  const body = await req.json().catch(() => ({}));
  if (body.roleId) {
    if (!validId(body.roleId)) return NextResponse.json({ error: 'Select a role' }, { status: 400 });
    const role = await Role.findById(body.roleId);
    if (!role) return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    admin.roleId = role._id;
  }
  if (body.name !== undefined) admin.name = String(body.name || '').trim().slice(0, 80) || admin.name;
  if (body.isActive !== undefined) admin.isActive = body.isActive !== false;
  if (body.password) {
    const check = validateStrongPassword(body.password);
    if (!check.valid) return NextResponse.json({ error: strongPasswordMessage() }, { status: 400 });
    admin.password = await bcrypt.hash(body.password, 12);
  }
  admin.role = 'staff';
  admin.isPrimary = false;
  admin.assignedBy = access.adminId;
  admin.assignedAt = new Date();
  await admin.save();
  const role = admin.roleId ? await Role.findById(admin.roleId).lean() : null;
  await logAdminAudit({
    access,
    req,
    action: admin.isActive === false ? 'assignment.revoke' : 'assignment.update',
    targetType: 'admin',
    targetId: admin._id,
    details: { email: admin.email, roleId: admin.roleId, isActive: admin.isActive },
  });
  return NextResponse.json({ assignment: publicAssignment(admin.toObject(), role) });
}

export async function DELETE(req, { params }) {
  const { error, access } = await requirePrimaryAdmin();
  if (error) return error;
  const { id } = await params;
  if (!validId(id)) return NextResponse.json({ error: 'Invalid assignment' }, { status: 400 });
  await dbConnect();
  const admin = await Admin.findById(id);
  if (!admin) return NextResponse.json({ error: 'Assigned user not found' }, { status: 404 });
  if (isPrimaryAdminRecord(admin)) return NextResponse.json({ error: 'The primary admin cannot be revoked' }, { status: 409 });
  admin.isActive = false;
  admin.assignedBy = access.adminId;
  await admin.save();
  await logAdminAudit({ access, req, action: 'assignment.revoke', targetType: 'admin', targetId: admin._id, details: { email: admin.email } });
  const role = admin.roleId ? await Role.findById(admin.roleId).lean() : null;
  return NextResponse.json({ assignment: publicAssignment(admin.toObject(), role) });
}
