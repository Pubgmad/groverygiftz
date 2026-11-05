import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Admin from '@/models/Admin';
import Role from '@/models/Role';
import AdminAuditLog from '@/models/AdminAuditLog';
import {
  ADMIN_UPLOAD_MODULES,
  emptyAdminPermissions,
  hasActionPermission,
  hasModulePermission,
  mergePermissionOverrides,
  normalizeEmail,
  normalizePermissions,
  primaryAdminAccess,
  publicAdminAccess,
} from '@/lib/adminPermissions';
import { normalizeDataVisibility } from '@/lib/adminPermissionCatalog';

export { publicAdminAccess, primaryAdminAccess };

async function getSession() {
  const { authOptions } = await import('@/lib/auth');
  return getServerSession(authOptions);
}

export function isPrimaryAdminRecord(admin) {
  if (!admin) return false;
  if (admin.isPrimary === true) return true;
  return String(admin.role || '').toLowerCase() === 'superadmin';
}

export function serializePermissions(permissions) {
  return normalizePermissions(permissions);
}

export async function loadAdminAccessById(adminId) {
  if (!adminId) return { ...publicAdminAccess(), accessStatus: 'missing', message: 'Unauthorized', status: 401 };
  await dbConnect();
  const admin = await Admin.findById(adminId).lean();
  if (!admin) return { ...publicAdminAccess(), accessStatus: 'missing', message: 'Unauthorized', status: 401 };

  if (isPrimaryAdminRecord(admin)) {
    return { ...primaryAdminAccess(), adminId: String(admin._id), email: admin.email, name: admin.name };
  }

  if (admin.isActive === false) {
    return {
      ok: false,
      status: 403,
      message: 'This admin access has been revoked',
      isPrimary: false,
      adminActive: false,
      accessStatus: 'revoked',
      roleId: admin.roleId ? String(admin.roleId) : null,
      roleName: '',
      permissions: emptyAdminPermissions(),
      adminId: String(admin._id),
      email: admin.email,
      name: admin.name,
    };
  }

  if (!admin.roleId) {
    return {
      ok: true,
      status: 200,
      message: '',
      isPrimary: false,
      adminActive: true,
      accessStatus: 'unassigned',
      roleId: null,
      roleName: '',
      permissions: emptyAdminPermissions(),
      adminId: String(admin._id),
      email: admin.email,
      name: admin.name,
    };
  }

  const role = await Role.findById(admin.roleId).lean();
  if (!role) {
    return {
      ok: true,
      status: 200,
      message: '',
      isPrimary: false,
      adminActive: true,
      accessStatus: 'unassigned',
      roleId: null,
      roleName: '',
      permissions: emptyAdminPermissions(),
      adminId: String(admin._id),
      email: admin.email,
      name: admin.name,
    };
  }

  if (role.isActive === false) {
    return {
      ok: false,
      status: 403,
      message: 'This role is inactive',
      isPrimary: false,
      adminActive: false,
      accessStatus: 'role-inactive',
      roleId: String(role._id),
      roleName: role.name,
      permissions: emptyAdminPermissions(),
      adminId: String(admin._id),
      email: admin.email,
      name: admin.name,
    };
  }

  const rolePerms = serializePermissions(role.permissions);
  const overrides = admin.permissionOverrides && typeof admin.permissionOverrides === 'object'
    ? admin.permissionOverrides
    : {};
  const permissions = Object.keys(overrides).length
    ? mergePermissionOverrides(role.permissions, overrides)
    : rolePerms;
  const roleVisibility = normalizeDataVisibility(role.dataVisibility, 'assigned');
  const staffVisibility = String(admin.dataVisibility || '').trim();
  const dataVisibility = staffVisibility
    ? normalizeDataVisibility(staffVisibility, roleVisibility)
    : roleVisibility;

  return {
    ok: true,
    status: 200,
    message: '',
    isPrimary: false,
    adminActive: true,
    accessStatus: 'active',
    roleId: String(role._id),
    roleName: role.name,
    roleSlug: role.slug || '',
    permissions,
    permissionOverrides: overrides,
    dataVisibility,
    adminId: String(admin._id),
    email: admin.email,
    name: admin.name,
  };
}

export async function getRequestAdminAccess(session) {
  if (!session?.user?.id || session.user.type !== 'admin') return publicAdminAccess();
  return loadAdminAccessById(session.user.id);
}

/**
 * @param {object} access
 * @param {string} moduleId
 * @param {'read'|'write'|string} action Module RW or granular action id
 */
export function can(access, moduleId, action = 'read') {
  if (!access?.ok) return false;
  if (access.isPrimary) return true;
  if (action === 'read' || action === 'write') {
    return hasModulePermission(access.permissions, moduleId, action);
  }
  return hasActionPermission(access.permissions, moduleId, action);
}

export async function requireAdminAction(moduleId, actionId) {
  const session = await getSession();
  const access = await getRequestAdminAccess(session);
  if (!session?.user || session.user.type !== 'admin' || access.accessStatus === 'unauthenticated' || access.accessStatus === 'missing') {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), access, session };
  }
  if (!access.ok) {
    return { error: NextResponse.json({ error: access.message || 'Forbidden' }, { status: 403 }), access, session };
  }
  if (!can(access, moduleId, actionId)) {
    return { error: NextResponse.json({ error: 'You do not have permission to perform this action' }, { status: 403 }), access, session };
  }
  return { error: null, access, session };
}

export async function requireAdminPermission(moduleId, action = 'read') {
  const session = await getSession();
  const access = await getRequestAdminAccess(session);
  if (!session?.user || session.user.type !== 'admin' || access.accessStatus === 'unauthenticated' || access.accessStatus === 'missing') {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), access, session };
  }
  if (!access.ok) {
    return { error: NextResponse.json({ error: access.message || 'Forbidden' }, { status: 403 }), access, session };
  }
  if (moduleId === 'roles') {
    if (!access.isPrimary) return { error: NextResponse.json({ error: 'Only the primary admin can manage roles and assignments' }, { status: 403 }), access, session };
    return { error: null, access, session };
  }
  if (!can(access, moduleId, action)) {
    return { error: NextResponse.json({ error: 'You do not have permission to perform this action' }, { status: 403 }), access, session };
  }
  return { error: null, access, session };
}

export async function requirePrimaryAdmin() {
  return requireAdminPermission('roles', 'write');
}

export async function requireUploadPermission(moduleId) {
  const requested = String(moduleId || '').trim();
  if (!ADMIN_UPLOAD_MODULES.includes(requested)) {
    return { error: NextResponse.json({ error: 'You do not have permission to perform this action' }, { status: 403 }) };
  }
  return requireAdminPermission(requested, 'write');
}

export function requestMeta(req) {
  const forwarded = String(req?.headers?.get?.('x-forwarded-for') || '').split(',')[0].trim();
  return {
    ip: forwarded.slice(0, 128),
    userAgent: String(req?.headers?.get?.('user-agent') || '').slice(0, 300),
  };
}

export async function logAdminAudit({ access, req, action, targetType, targetId, details }) {
  try {
    await dbConnect();
    const meta = requestMeta(req);
    await AdminAuditLog.create({
      actorId: access?.adminId || access?.sessionUserId || null,
      actorEmail: normalizeEmail(access?.email || ''),
      action,
      targetType: targetType || '',
      targetId: String(targetId || ''),
      details: details || {},
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  } catch (error) {
    console.error('Admin audit log failed');
  }
}

export function accessForSession(access) {
  return {
    isPrimary: !!access?.isPrimary,
    adminActive: !!access?.adminActive && !!access?.ok,
    accessStatus: access?.accessStatus || 'unauthenticated',
    roleId: access?.roleId || null,
    roleName: access?.roleName || '',
    roleSlug: access?.roleSlug || '',
    dataVisibility: access?.isPrimary ? 'all' : (access?.dataVisibility || 'assigned'),
    permissions: serializePermissions(access?.permissions),
  };
}
