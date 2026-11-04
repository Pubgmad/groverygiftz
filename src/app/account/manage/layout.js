import AdminManageClientLayout from '@/components/admin/AdminManageClientLayout';

/** Admin panel requires session/API data — do not statically prerender. */
export const dynamic = 'force-dynamic';

export default function AdminManageLayout({ children }) {
  return <AdminManageClientLayout>{children}</AdminManageClientLayout>;
}
