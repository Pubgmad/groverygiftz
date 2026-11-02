'use client';

import { useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { fullAdminPermissions, hasModulePermission } from '@/lib/adminPermissions';

export default function useAdminAccess() {
  const { data: session, status } = useSession();

  return useMemo(() => {
    const isPrimary = !!session?.user?.isPrimary;
    const permissions = isPrimary ? fullAdminPermissions() : (session?.user?.permissions || {});
    const canRead = (moduleId) => isPrimary || hasModulePermission(permissions, moduleId, 'read');
    const canWrite = (moduleId) => isPrimary || hasModulePermission(permissions, moduleId, 'write');
    return {
      status,
      session,
      isPrimary,
      adminActive: isPrimary || !!session?.user?.adminActive,
      accessStatus: session?.user?.accessStatus || 'unauthenticated',
      roleName: session?.user?.roleName || '',
      permissions,
      canRead,
      canWrite,
    };
  }, [session, status]);
}
