'use client';
import { getSession, useSession } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminHeader from '@/components/admin/AdminHeader';
import useAdminAccess from '@/hooks/useAdminAccess';
import { ADMIN_BASE_PATH, ADMIN_MODULES, moduleIdFromPath } from '@/lib/adminPermissions';

export default function AdminLayout({ children }) {
  const { data: session, status } = useSession();
  const access = useAdminAccess();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const moduleId = useMemo(() => moduleIdFromPath(pathname), [pathname]);
  const isAdmin = session?.user?.type === 'admin';

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/admin/login');
    if (status === 'authenticated' && !isAdmin) router.push('/admin/login');
  }, [status, isAdmin, router]);

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (status !== 'authenticated' || !isAdmin) return undefined;
    const timer = setInterval(() => { getSession(); }, 30000);
    return () => clearInterval(timer);
  }, [status, isAdmin]);

  useEffect(() => {
    if (status !== 'authenticated' || !isAdmin) return;
    if (access.isPrimary || access.canRead('dashboard')) return;
    const first = ADMIN_MODULES.find((module) => access.canRead(module.id));
    if (pathname === ADMIN_BASE_PATH || pathname === `${ADMIN_BASE_PATH}/`) {
      router.replace(first?.href || ADMIN_BASE_PATH);
    }
  }, [status, isAdmin, access.isPrimary, access.canRead, pathname, router]);

  if (status === 'loading' && !session) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!session || session.user.type !== 'admin') return null;

  const denied = (() => {
    if (access.accessStatus === 'revoked' || access.accessStatus === 'role-inactive' || access.accessStatus === 'missing') {
      return access.accessStatus === 'role-inactive' ? 'This role is inactive. Ask the primary admin to restore access.' : 'Your admin access has been revoked.';
    }
    if (moduleId === 'roles' && !access.isPrimary) return 'Only the primary admin can manage roles and permissions.';
    if (moduleId && moduleId !== 'roles' && !access.canRead(moduleId)) return 'You do not have permission to view this section.';
    if ((pathname === ADMIN_BASE_PATH || pathname === `${ADMIN_BASE_PATH}/`) && !access.canRead('dashboard') && !ADMIN_MODULES.some((module) => access.canRead(module.id))) {
      return 'No dashboard modules have been assigned to your role yet.';
    }
    return '';
  })();

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {mobileSidebarOpen && (
        <button
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
          aria-label="Close sidebar backdrop"
        />
      )}
      <AdminSidebar mobileOpen={mobileSidebarOpen} onClose={() => setMobileSidebarOpen(false)} />
      <div className="flex-1 min-w-0">
        <AdminHeader onMenuClick={() => setMobileSidebarOpen(true)} />
        <main className="p-4 md:p-6">
          {denied ? (
            <div className="mx-auto max-w-lg rounded-2xl border bg-white p-6 text-center">
              <h1 className="text-xl font-bold">Access denied</h1>
              <p className="mt-2 text-sm text-gray-500">{denied}</p>
            </div>
          ) : children}
        </main>
      </div>
    </div>
  );
}
