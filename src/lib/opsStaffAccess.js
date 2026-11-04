import mongoose from 'mongoose';
import { roleSlugFromName } from '@/lib/adminPermissions';

const OVERSIGHT_SLUGS = new Set(['owner-admin', 'owner', 'admin', 'superadmin']);
const OVERSIGHT_NAMES = new Set(['owner/admin', 'owner', 'admin', 'superadmin', 'primary admin']);

/** Primary admin or named Owner/Admin role has full ops oversight. */
export function isOpsOversight(access) {
  if (!access) return false;
  if (access.isPrimary) return true;
  const slug = String(access.roleSlug || roleSlugFromName(access.roleName || '') || '').toLowerCase();
  const name = String(access.roleName || '').toLowerCase().trim();
  if (OVERSIGHT_SLUGS.has(slug)) return true;
  if (OVERSIGHT_NAMES.has(name)) return true;
  // Permissions that imply full ops oversight (primary-equivalent)
  if (access.isPrimary === true) return true;
  return false;
}

/** Mongo filter limiting orders to those the staff member may see. */
export function staffOrderScopeFilter(access) {
  if (isOpsOversight(access)) return {};
  const adminId = access?.adminId;
  if (!adminId) return { _id: { $exists: false } };
  return {
    $or: [
      { assignedTo: access.adminId },
      { createdByAdmin: access.adminId },
      { printingAssignedTo: access.adminId },
    ],
  };
}

/** Mongo filter limiting tasks to assignee (oversight sees all). */
export function staffTaskScopeFilter(access) {
  if (isOpsOversight(access)) return {};
  if (!access?.adminId) return { _id: { $exists: false } };
  return { assignedTo: access.adminId };
}

export function assertCanAccessOrder(access, order) {
  if (!order) return false;
  if (isOpsOversight(access)) return true;
  const adminId = String(access?.adminId || '');
  if (!adminId) return false;
  const ids = [
    order.assignedTo,
    order.createdByAdmin,
    order.printingAssignedTo,
  ].map((v) => (v ? String(v._id || v) : '')).filter(Boolean);
  return ids.includes(adminId);
}

/** Merge staff scope into an existing filter object (handles $and safely). */
export function mergeStaffOrderFilter(baseFilter, access) {
  const scope = staffOrderScopeFilter(access);
  if (!scope || !Object.keys(scope).length) return baseFilter || {};
  if (!baseFilter || !Object.keys(baseFilter).length) return scope;
  return { $and: [baseFilter, scope] };
}

/** Merge task scope into filter (no-op for oversight). */
export function mergeStaffTaskFilter(baseFilter, access) {
  const scope = staffTaskScopeFilter(access);
  if (!scope || !Object.keys(scope).length) return baseFilter || {};
  if (!baseFilter || !Object.keys(baseFilter).length) return scope;
  return { ...baseFilter, ...scope };
}

export function isValidAdminObjectId(id) {
  return Boolean(id && mongoose.Types.ObjectId.isValid(String(id)));
}
