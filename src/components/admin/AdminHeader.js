'use client';
import { useSession, signOut } from 'next-auth/react';
import { FiMenu } from 'react-icons/fi';

export default function AdminHeader({ onMenuClick = () => {} }) {
  const { data: session } = useSession();

  return (
    <header className="bg-white border-b px-6 py-4 flex justify-between items-center sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <button onClick={onMenuClick} className="lg:hidden p-2 border rounded-lg hover:bg-gray-50" aria-label="Open menu">
          <FiMenu size={18} />
        </button>
        <h2 className="text-lg font-semibold text-gray-700">Admin Dashboard</h2>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-500 hidden sm:inline">{session?.user?.name || session?.user?.email}</span>
        <button onClick={() => signOut({ callbackUrl: '/admin/login' })}
          className="text-sm text-red-600 hover:text-red-800">Sign Out</button>
      </div>
    </header>
  );
}
