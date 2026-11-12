'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FiHome, FiPackage, FiGrid, FiTruck, FiShoppingCart, FiUsers, FiImage, FiFileText, FiBookOpen, FiMail, FiMessageSquare, FiSettings, FiX, FiStar, FiGift, FiClock, FiShield, FiBarChart2, FiTool, FiClipboard, FiBox } from 'react-icons/fi';
import useAdminAccess from '@/hooks/useAdminAccess';
import { ADMIN_BASE_PATH } from '@/lib/adminPermissions';

const iconMap = {
  dashboard: FiHome,
  products: FiPackage,
  'preview-3d': FiBox,
  'photo-frame-3d': FiBox,
  'making-cost': FiTool,
  collections: FiGrid,
  shipping: FiTruck,
  'estimated-delivery': FiClock,
  orders: FiShoppingCart,
  operations: FiClipboard,
  reports: FiBarChart2,
  revenue: FiBarChart2,
  customers: FiUsers,
  reviews: FiStar,
  banners: FiImage,
  'gift-recommender': FiGift,
  blogs: FiBookOpen,
  pages: FiFileText,
  newsletter: FiMail,
  messages: FiMessageSquare,
  settings: FiSettings,
};

const navItems = [
  { id: 'dashboard', href: ADMIN_BASE_PATH, label: 'Dashboard' },
  { id: 'products', href: `${ADMIN_BASE_PATH}/products`, label: 'Products' },
  { id: 'preview-3d', href: `${ADMIN_BASE_PATH}/preview-3d`, label: '3D Profiles', moduleId: 'products' },
  { id: 'photo-frame-3d', href: `${ADMIN_BASE_PATH}/photo-frame-3d`, label: 'Photo Frame 3D', moduleId: 'products' },
  { id: 'making-cost', href: `${ADMIN_BASE_PATH}/making-cost`, label: 'Making Cost' },
  { id: 'collections', href: `${ADMIN_BASE_PATH}/collections`, label: 'Collections' },
  { id: 'shipping', href: `${ADMIN_BASE_PATH}/shipping`, label: 'Shipping Templates' },
  { id: 'estimated-delivery', href: `${ADMIN_BASE_PATH}/estimated-delivery`, label: 'Estimated Delivery Days' },
  { id: 'orders', href: `${ADMIN_BASE_PATH}/orders`, label: 'Orders' },
  { id: 'operations', href: `${ADMIN_BASE_PATH}/operations`, label: 'Operations' },
  { id: 'reports', href: `${ADMIN_BASE_PATH}/reports`, label: 'Payment & Dispatch Reports' },
  { id: 'revenue', href: `${ADMIN_BASE_PATH}/revenue`, label: 'Revenue Analytics' },
  { id: 'customers', href: `${ADMIN_BASE_PATH}/customers`, label: 'Customers' },
  { id: 'reviews', href: `${ADMIN_BASE_PATH}/reviews`, label: 'Reviews' },
  { id: 'banners', href: `${ADMIN_BASE_PATH}/banners`, label: 'Banners' },
  { id: 'gift-recommender', href: `${ADMIN_BASE_PATH}/gift-recommender`, label: 'Gift Recommender' },
  { id: 'blogs', href: `${ADMIN_BASE_PATH}/blogs`, label: 'Blogs' },
  { id: 'pages', href: `${ADMIN_BASE_PATH}/pages`, label: 'Pages' },
  { id: 'newsletter', href: `${ADMIN_BASE_PATH}/newsletter`, label: 'Newsletter' },
  { id: 'messages', href: `${ADMIN_BASE_PATH}/messages`, label: 'Messages' },
  { id: 'settings', href: `${ADMIN_BASE_PATH}/settings`, label: 'Settings' },
];

export default function AdminSidebar({ mobileOpen = false, onClose = () => {} }) {
  const pathname = usePathname();
  const { isPrimary, canRead, roleName } = useAdminAccess();
  const visibleItems = navItems.filter((item) => {
    const permissionId = item.moduleId || item.id;
    if (canRead(permissionId)) return true;
    // New reports module: allow via orders/operations until roles are updated
    if (item.id === 'reports') return canRead('orders') || canRead('operations');
    return false;
  });

  return (
    <aside className={`w-64 bg-gray-900 text-white fixed lg:static inset-y-0 left-0 z-40 overflow-y-auto transform transition-transform duration-200 ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
      <div className="p-6 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <Link href={ADMIN_BASE_PATH} className="text-xl font-bold" onClick={onClose}>GroveryGiftz</Link>
          <button className="lg:hidden text-gray-300 hover:text-white" onClick={onClose} aria-label="Close menu">
            <FiX size={18} />
          </button>
        </div>
        <p className="text-gray-400 text-xs mt-1">{isPrimary ? 'Primary Admin' : (roleName || 'Admin Panel')}</p>
      </div>
      <nav className="p-4 space-y-1">
        {visibleItems.map((item) => {
          const Icon = iconMap[item.id] || FiHome;
          const isActive = pathname === item.href || (item.href !== ADMIN_BASE_PATH && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href}
              onClick={onClose}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-colors ${isActive ? 'bg-primary-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}>
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
        {isPrimary && (
          <Link href={`${ADMIN_BASE_PATH}/roles`} onClick={onClose}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-colors ${pathname.startsWith(`${ADMIN_BASE_PATH}/roles`) ? 'bg-primary-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}>
            <FiShield size={18} />
            Roles & Permissions
          </Link>
        )}
      </nav>
      <div className="p-4 border-t border-gray-700 mt-4">
        <Link href="/" target="_blank" className="flex items-center gap-2 text-gray-400 hover:text-white text-sm">
          View Store
        </Link>
      </div>
    </aside>
  );
}
