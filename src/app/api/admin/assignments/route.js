import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import dbConnect from '@/lib/db';
import Admin from '@/models/Admin';
import Role from '@/models/Role';
import { isPrimaryAdminRecord, logAdminAudit, requirePrimaryAdmin } from '@/lib/adminAccess';
import { isValidEmail, normalizeEmail } from '@/lib/adminPermissions';
import { strongPasswordMessage, validateStrongPassword } from '@/lib/passwordPolicy';

export const dynamic = 'force-dynamic';

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

export async function GET() {
  const { error } = await requirePrimaryAdmin();
  if (error) return error;
  await dbConnect();
  const staff = await Admin.find({ isPrimary: { $ne: true }, role: { $ne: 'superadmin' } }).sort({ createdAt: -1 }).lean();
  const roles = await Role.find({ _id: { $in: staff.map((row) => row.roleId).filter(Boolean) } }).lean();
  const roleMap = Object.fromEntries(roles.map((role) => [String(role._id), role]));
  return NextResponse.json({
    assignments: staff.filter((admin) => !isPrimaryAdminRecord(admin)).map((admin) => publicAssignment(admin, roleMap[String(admin.roleId || '')])),
  });
}

export async function POST(req) {
  const { error, access } = await requirePrimaryAdmin();
  if (error) return error;
  await dbConnect();
  const body = await req.json().catch(() => ({}));
  const email = normalizeEmail(body.email);
  const roleId = String(body.roleId || '').trim();
  const name = String(body.name || '').trim().slice(0, 80) || email.split('@')[0];
  if (!isValidEmail(email)) return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 });
  if (email === normalizeEmail(access.email)) return NextResponse.json({ error: 'The primary admin cannot be assigned a limited role' }, { status: 409 });
  if (!/^[a-fA-F0-9]{24}$/.test(roleId)) return NextResponse.json({ error: 'Select a role' }, { status: 400 });

  const role = await Role.findById(roleId);
  if (!role) return NextResponse.json({ error: 'Role not found' }, { status: 404 });
  if (role.isActive === false) return NextResponse.json({ error: 'Activate this role before assigning it' }, { status: 409 });

  const existing = await Admin.findOne({ email }).collation({ locale: 'en', strength: 2 });
  if (existing && isPrimaryAdminRecord(existing)) {
    return NextResponse.json({ error: 'The primary admin cannot be assigned a limited role' }, { status: 409 });
  }

  if (existing) {
    existing.name = name || existing.name;
    existing.roleId = role._id;
    existing.role = 'staff';
    existing.isPrimary = false;
    existing.isActive = true;
    existing.assignedBy = access.adminId;
    existing.assignedAt = new Date();
    if (body.password) {
      const check = validateStrongPassword(body.password);
      if (!check.valid) return NextResponse.json({ error: strongPasswordMessage() }, { status: 400 });
      existing.password = await bcrypt.hash(body.password, 12);
    }
    await existing.save();
    await logAdminAudit({ access, req, action: 'assignment.update', targetType: 'admin', targetId: existing._id, details: { email, roleId: String(role._id), roleName: role.name } });
    return NextResponse.json({ assignment: publicAssignment(existing.toObject(), role) });
  }

  const check = validateStrongPassword(body.password || '');
  if (!check.valid) return NextResponse.json({ error: strongPasswordMessage() }, { status: 400 });
  const admin = await Admin.create({
    name,
    email,
    password: await bcrypt.hash(body.password, 12),
    role: 'staff',
    isPrimary: false,
    isActive: true,
    roleId: role._id,
    assignedBy: access.adminId,
    assignedAt: new Date(),
  });
  await logAdminAudit({ access, req, action: 'assignment.create', targetType: 'admin', targetId: admin._id, details: { email, roleId: String(role._id), roleName: role.name } });
  return NextResponse.json({ assignment: publicAssignment(admin.toObject(), role) }, { status: 201 });
}
