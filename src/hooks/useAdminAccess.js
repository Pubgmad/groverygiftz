'use client';

import { useSession } from 'next-auth/react';
import { fullAdminPermissions, hasModulePermission } from '@/lib/adminPermissions';

export default function useAdminAccess() {
  const { data: session, status, update } = useSession();
  const isPrimary = !!session?.user?.isPrimary;
  const permissions = isPrimary ? fullAdminPermissions() : (session?.user?.permissions || {});
  const canRead = (moduleId) => isPrimary || hasModulePermission(permissions, moduleId, 'read');
  const canWrite = (moduleId) => isPrimary || hasModulePermission(permissions, moduleId, 'write');

  return {
    status,
    session,
    update,
    isPrimary,
    adminActive: isPrimary || !!session?.user?.adminActive,
    accessStatus: session?.user?.accessStatus || 'unauthenticated',
    roleName: session?.user?.roleName || '',
    permissions,
    canRead,
    canWrite,
  };
}
