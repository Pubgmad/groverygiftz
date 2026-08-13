'use client';
import { useSession, signOut } from 'next-auth/react';
import { FiMenu } from 'react-icons/fi';

export default function AdminHeader({ onMenuClick = () => {} }) {
  const { data: session } = useSession();

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-white px-4 py-3 sm:px-6 sm:py-4">
      <div className="flex min-w-0 items-center gap-3">
        <button onClick={onMenuClick} className="lg:hidden p-2 border rounded-lg hover:bg-gray-50" aria-label="Open menu">
          <FiMenu size={18} />
        </button>
        <h2 className="truncate text-base font-semibold text-gray-700 sm:text-lg">Admin Dashboard</h2>
      </div>
      <div className="flex shrink-0 items-center gap-3 sm:gap-4">
        <span className="text-sm text-gray-500 hidden sm:inline">{session?.user?.name || session?.user?.email}</span>
        <button onClick={() => signOut({ callbackUrl: '/admin/login' })}
          className="text-sm text-red-600 hover:text-red-800">Sign Out</button>
      </div>
    </header>
  );
}
