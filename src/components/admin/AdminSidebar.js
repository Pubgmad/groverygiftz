'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FiHome, FiPackage, FiGrid, FiTruck, FiShoppingCart, FiUsers, FiImage, FiFileText, FiBookOpen, FiMail, FiMessageSquare, FiSettings, FiX, FiStar } from 'react-icons/fi';

const BASE = '/account/manage';
const navItems = [
  { href: BASE, icon: FiHome, label: 'Dashboard' },
  { href: `${BASE}/products`, icon: FiPackage, label: 'Products' },
  { href: `${BASE}/collections`, icon: FiGrid, label: 'Collections' },
  { href: `${BASE}/shipping`, icon: FiTruck, label: 'Shipping Templates' },
  { href: `${BASE}/orders`, icon: FiShoppingCart, label: 'Orders' },
  { href: `${BASE}/customers`, icon: FiUsers, label: 'Customers' },
  { href: `${BASE}/reviews`, icon: FiStar, label: 'Reviews' },
  { href: `${BASE}/banners`, icon: FiImage, label: 'Banners' },
  { href: `${BASE}/blogs`, icon: FiBookOpen, label: 'Blogs' },
  { href: `${BASE}/pages`, icon: FiFileText, label: 'Pages' },
  { href: `${BASE}/newsletter`, icon: FiMail, label: 'Newsletter' },
  { href: `${BASE}/messages`, icon: FiMessageSquare, label: 'Messages' },
  { href: `${BASE}/settings`, icon: FiSettings, label: 'Settings' },
];
export default function AdminSidebar({ mobileOpen = false, onClose = () => {} }) {
  const pathname = usePathname();

  return (
    <aside className={`w-64 bg-gray-900 text-white fixed lg:static inset-y-0 left-0 z-40 overflow-y-auto transform transition-transform duration-200 ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
      <div className="p-6 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <Link href={BASE} className="text-xl font-bold" onClick={onClose}>GroveryGiftz</Link>
          <button className="lg:hidden text-gray-300 hover:text-white" onClick={onClose} aria-label="Close menu">
            <FiX size={18} />
          </button>
        </div>
        <p className="text-gray-400 text-xs mt-1">Admin Panel</p>
      </div>
      <nav className="p-4 space-y-1">
        {navItems.map(item => {
          const isActive = pathname === item.href || (item.href !== BASE && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href}
              onClick={onClose}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-colors ${isActive ? 'bg-primary-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}>
              <item.icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-gray-700 mt-4">
        <Link href="/" target="_blank" className="flex items-center gap-2 text-gray-400 hover:text-white text-sm">
          View Store →
        </Link>
      </div>
    </aside>
  );
}
