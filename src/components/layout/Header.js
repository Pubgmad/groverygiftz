'use client';
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { FiSearch, FiUser, FiShoppingBag, FiMenu, FiX, FiChevronDown, FiHeart } from 'react-icons/fi';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { useSession } from 'next-auth/react';

const menuItems = [
  { label: 'Home', href: '/' },
  { label: 'Shop', href: '/shop', megaMenu: true },
  { label: 'Gift Finder', href: '/#smart-gift-finder' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
  { label: 'Blog', href: '/blogs' },
];

const megaCollections = [
  { label: 'Love Combos', href: '/collections/love-combos', emoji: '💝', color: 'bg-accent-50 text-accent-600' },
  { label: 'Birthday Gifts', href: '/collections/birthday-gifts', emoji: '🎂', color: 'bg-amber-50 text-amber-600' },
  { label: 'Personalized Gifts', href: '/collections/personalized-gifts', emoji: '✨', color: 'bg-primary-50 text-primary-600' },
  { label: 'Return Gifts', href: '/collections/return-gifts', emoji: '🎁', color: 'bg-primary-100 text-primary-700' },
];

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [megaOpen, setMegaOpen] = useState(false);
  const { cartCount, setIsCartOpen } = useCart();
  const { wishlistCount } = useWishlist();
  const { data: session } = useSession();
  const accountHref = '/account';

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/search?q=${encodeURIComponent(searchQuery.trim())}`;
      setSearchOpen(false);
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm shadow-sm border-b border-gray-100">
      {/* Brand gradient top bar */}
      <div className="h-[3px] w-full" style={{ background: 'linear-gradient(90deg, #2456D8 0%, #F47920 40%, #2456D8 70%, #F47920 100%)' }} />

      <div className="max-w-7xl mx-auto px-2.5 sm:px-4">
        <div className="grid h-16 grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-1 sm:gap-3 md:flex md:h-20 md:justify-between">

          {/* Mobile toggle */}
          <button
            className="md:hidden flex h-10 w-10 items-center justify-center text-gray-600 hover:text-primary-600 transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <FiX size={24} /> : <FiMenu size={24} />}
          </button>

          {/* Logo */}
          <Link href="/" className="group flex min-w-0 items-center justify-center gap-1.5 sm:gap-2.5 md:justify-start md:flex-shrink-0">
            <Image
              src="/logo.svg"
              alt="GroveryGiftz Logo"
              width={34}
              height={42}
              className="h-10 w-auto shrink-0 transition-transform duration-200 group-hover:scale-105 sm:h-[46px]"
              priority
            />
            <div className="min-w-0 leading-none">
              <span className="text-[17px] sm:text-xl md:text-2xl font-display font-bold text-primary-600 tracking-tight">
                Grovery
              </span>
              <span className="text-[17px] sm:text-xl md:text-2xl font-display font-bold text-accent-500 tracking-tight">
                Giftz
              </span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center space-x-1">
            {menuItems.map(item =>
              item.megaMenu ? (
                <div
                  key={item.href}
                  className="relative"
                  onMouseEnter={() => setMegaOpen(true)}
                  onMouseLeave={() => setMegaOpen(false)}
                >
                  <Link
                    href={item.href}
                    className="nav-link flex items-center gap-1 px-3 py-2 rounded-lg hover:bg-primary-50"
                  >
                    {item.label} <FiChevronDown size={14} className={`transition-transform duration-200 ${megaOpen ? 'rotate-180' : ''}`} />
                  </Link>
                  {megaOpen && (
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-white rounded-2xl shadow-brand-lg border border-primary-100 p-5 w-[480px] z-50">
                      <p className="text-xs font-semibold uppercase tracking-widest text-primary-400 mb-3 px-1 flex items-center gap-1.5"><span>✦</span> Collections</p>
                      <div className="grid grid-cols-2 gap-2">
                        {megaCollections.map(col => (
                          <Link
                            key={col.href}
                            href={col.href}
                            className="group flex items-center gap-3 p-3 rounded-xl hover:bg-primary-50 transition-colors"
                          >
                            <div className={`w-12 h-12 rounded-xl ${col.color} flex items-center justify-center flex-shrink-0 text-xl`}>
                              {col.emoji}
                            </div>
                            <div>
                              <span className="font-semibold text-gray-800 group-hover:text-primary-600 transition-colors text-sm block">
                                {col.label}
                              </span>
                              <span className="text-xs text-gray-400">Explore →</span>
                            </div>
                          </Link>
                        ))}
                      </div>
                      <div className="mt-3 pt-3 border-t border-gray-100 text-center">
                        <Link href="/shop" className="inline-flex items-center gap-1 text-white font-semibold text-sm bg-gradient-to-r from-primary-600 to-primary-500 hover:from-accent-500 hover:to-accent-600 px-4 py-1.5 rounded-lg transition-all duration-200">
                          View All Products →
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  className="nav-link px-3 py-2 rounded-lg hover:bg-primary-50"
                >
                  {item.label}
                </Link>
              )
            )}
          </nav>

          {/* Icons */}
          <div className="flex items-center justify-end gap-0 sm:gap-1">
            <button
              onClick={() => setSearchOpen(!searchOpen)}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-600 transition-all hover:bg-primary-50 hover:text-primary-600 sm:h-10 sm:w-10"
              aria-label="Search"
            >
              <FiSearch size={20} />
            </button>
            <Link
              href={session ? accountHref : '/auth/login'}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-600 transition-all hover:bg-primary-50 hover:text-primary-600 sm:h-10 sm:w-10"
              aria-label="Account"
            >
              <FiUser size={20} />
            </Link>
            <Link
              href="/wishlist"
              className="relative flex h-9 w-9 items-center justify-center rounded-xl text-gray-600 transition-all hover:bg-accent-50 hover:text-accent-500 sm:h-10 sm:w-10"
              aria-label="Wishlist"
            >
              <FiHeart size={20} />
              {wishlistCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-accent-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold shadow-orange">
                  {wishlistCount}
                </span>
              )}
            </Link>
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative flex h-9 w-9 items-center justify-center rounded-xl text-gray-600 transition-all hover:bg-primary-50 hover:text-primary-600 sm:h-10 sm:w-10"
              aria-label="Cart"
            >
              <FiShoppingBag size={20} />
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-accent-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold shadow-orange">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Search bar */}
      {searchOpen && (
        <div className="border-t bg-white py-4 px-4 shadow-sm">
          <form onSubmit={handleSearch} className="max-w-2xl mx-auto flex gap-0">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search for gifts, occasions, names…"
              className="flex-1 border border-r-0 border-gray-200 rounded-l-xl px-4 py-3 text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
              autoFocus
            />
            <button
              type="submit"
              className="bg-primary-600 text-white px-4 sm:px-6 py-3 rounded-r-xl hover:bg-primary-700 transition-colors font-semibold text-sm"
            >
              Search
            </button>
          </form>
        </div>
      )}

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t bg-white shadow-lg">
          <nav className="flex flex-col py-3">
            {menuItems.map(item => (
              <div key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="px-5 py-3 text-gray-700 hover:bg-primary-50 hover:text-primary-600 font-medium block transition-colors"
                >
                  {item.label}
                </Link>
                {item.megaMenu && (
                  <div className="bg-gray-50 px-5 sm:px-8 py-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
                    {megaCollections.map(col => (
                      <Link
                        key={col.href}
                        href={col.href}
                        onClick={() => setMobileOpen(false)}
                        className="py-2 text-sm text-gray-600 hover:text-primary-600 flex items-center gap-1.5 transition-colors"
                      >
                        <span>{col.emoji}</span> {col.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div className="border-t mt-2 pt-2 px-5">
              <Link href="/track-order" onClick={() => setMobileOpen(false)}
                className="py-3 text-gray-700 hover:text-accent-500 font-medium block text-sm transition-colors">
                📦 Track Your Order
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

