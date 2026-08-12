'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FiSearch, FiUser, FiShoppingBag, FiMenu, FiX, FiChevronDown, FiHeart, FiGift } from 'react-icons/fi';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { useSession } from 'next-auth/react';
import { formatPrice, getDisplayPrice } from '@/lib/utils';

const menuItems = [
  { label: 'Home', href: '/' },
  { label: 'Shop', href: '/shop', megaMenu: true },
  { label: 'Gift Recommender', href: '/#smart-gift-finder' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
  { label: 'Blog', href: '/blogs' },
];

const megaCollections = [
  { label: 'Love Combos', href: '/collections/love-combos', color: 'bg-accent-50 text-accent-600' },
  { label: 'Birthday Gifts', href: '/collections/birthday-gifts', color: 'bg-amber-50 text-amber-600' },
  { label: 'Personalized Gifts', href: '/collections/personalized-gifts', color: 'bg-primary-50 text-primary-600' },
  { label: 'Return Gifts', href: '/collections/return-gifts', color: 'bg-primary-100 text-primary-700' },
];

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [suggesting, setSuggesting] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const [settings, setSettings] = useState(null);
  const [menuCollections, setMenuCollections] = useState([]);
  const { cartCount, setIsCartOpen } = useCart();
  const { wishlistCount } = useWishlist();
  const { data: session } = useSession();
  const accountHref = session?.user?.type === 'customer' ? '/account' : '/auth/login';
  const logoSrc = settings?.desktopLogo || settings?.logo || '';
  const tabletLogoSrc = settings?.tabletLogo || logoSrc;
  const mobileLogoSrc = settings?.mobileLogo || tabletLogoSrc;
  const siteName = settings?.siteName || 'GroveryGiftz';
  const settingsLoaded = settings !== null;

  useEffect(() => {
    fetch('/api/settings').then((r) => r.json()).then(setSettings).catch(() => setSettings({}));
    fetch('/api/collections')
      .then((r) => r.json())
      .then((data) => {
        const colors = ['bg-accent-50 text-accent-600', 'bg-amber-50 text-amber-600', 'bg-primary-50 text-primary-600', 'bg-primary-100 text-primary-700'];
        setMenuCollections((data.collections || []).slice(0, 6).map((col, idx) => ({
          label: col.name,
          href: `/collections/${col.slug}`,
          color: colors[idx % colors.length],
        })));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length < 2) {
      setSuggestions([]);
      setSuggesting(false);
      return;
    }
    setSuggesting(true);
    const timer = setTimeout(() => {
      fetch(`/api/products?search=${encodeURIComponent(query)}&limit=6`)
        .then((res) => res.json())
        .then((data) => setSuggestions(data.products || []))
        .catch(() => setSuggestions([]))
        .finally(() => setSuggesting(false));
    }, 180);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const visibleMegaCollections = menuCollections.length ? menuCollections : megaCollections;

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery('');
    setSuggestions([]);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (query) {
      window.location.href = `/search?q=${encodeURIComponent(query)}`;
      closeSearch();
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm shadow-sm border-b border-gray-100">
      <div className="h-[3px] w-full" style={{ background: 'linear-gradient(90deg, #2456D8 0%, #F47920 40%, #2456D8 70%, #F47920 100%)' }} />

      <div className="max-w-7xl mx-auto px-2.5 sm:px-4">
        <div className="grid h-16 grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-1 sm:gap-3 md:flex md:h-20 md:justify-between">
          <button className="md:hidden flex h-10 w-10 items-center justify-center text-gray-600 hover:text-primary-600 transition-colors" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle menu">
            {mobileOpen ? <FiX size={24} /> : <FiMenu size={24} />}
          </button>

          <Link href="/" className="group flex min-w-0 items-center justify-center gap-1.5 sm:gap-2.5 md:justify-start md:flex-shrink-0">
            {!settingsLoaded ? (
              <span className="block h-12 w-[180px] sm:h-14 md:h-16 md:w-[240px]" aria-hidden="true" />
            ) : logoSrc ? (
              <picture>
                <source media="(max-width: 639px)" srcSet={mobileLogoSrc} />
                <source media="(max-width: 1023px)" srcSet={tabletLogoSrc} />
                <img src={logoSrc} alt={siteName} className="h-12 max-w-[210px] shrink-0 object-contain transition-transform duration-200 group-hover:scale-105 sm:h-14 md:h-16 md:max-w-[280px]" />
              </picture>
            ) : (
              <div className="min-w-0 leading-none">
                <span className="text-[17px] sm:text-xl md:text-2xl font-display font-bold text-primary-600 tracking-tight">Grovery</span>
                <span className="text-[17px] sm:text-xl md:text-2xl font-display font-bold text-accent-500 tracking-tight">Giftz</span>
              </div>
            )}
          </Link>

          <nav className="hidden md:flex items-center space-x-1">
            {menuItems.map(item => item.megaMenu ? (
              <div key={item.href} className="relative" onMouseEnter={() => setMegaOpen(true)} onMouseLeave={() => setMegaOpen(false)}>
                <Link href={item.href} className="nav-link flex items-center gap-1 px-3 py-2 rounded-lg hover:bg-primary-50">
                  {item.label} <FiChevronDown size={14} className={`transition-transform duration-200 ${megaOpen ? 'rotate-180' : ''}`} />
                </Link>
                {megaOpen && (
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-white rounded-2xl shadow-brand-lg border border-primary-100 p-5 w-[480px] z-50">
                    <p className="text-xs font-semibold uppercase tracking-widest text-primary-400 mb-3 px-1">Collections</p>
                    <div className="grid grid-cols-2 gap-2">
                      {visibleMegaCollections.map(col => (
                        <Link key={col.href} href={col.href} className="group flex items-center gap-3 p-3 rounded-xl hover:bg-primary-50 transition-colors">
                          <div className={`w-12 h-12 rounded-xl ${col.color} flex items-center justify-center flex-shrink-0`}><FiGift size={20} /></div>
                          <div>
                            <span className="font-semibold text-gray-800 group-hover:text-primary-600 transition-colors text-sm block">{col.label}</span>
                            <span className="text-xs text-gray-400">Explore</span>
                          </div>
                        </Link>
                      ))}
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-100 text-center">
                      <Link href="/shop" className="inline-flex items-center gap-1 text-white font-semibold text-sm bg-gradient-to-r from-primary-600 to-primary-500 hover:from-accent-500 hover:to-accent-600 px-4 py-1.5 rounded-lg transition-all duration-200">View All Products</Link>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link key={item.href} href={item.href} className="nav-link px-3 py-2 rounded-lg hover:bg-primary-50">{item.label}</Link>
            ))}
          </nav>

          <div className="flex items-center justify-end gap-0 sm:gap-1">
            <button onClick={() => setSearchOpen(!searchOpen)} className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-600 transition-all hover:bg-primary-50 hover:text-primary-600 sm:h-10 sm:w-10" aria-label="Search"><FiSearch size={20} /></button>
            <Link href={accountHref} className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-600 transition-all hover:bg-primary-50 hover:text-primary-600 sm:h-10 sm:w-10" aria-label="Account"><FiUser size={20} /></Link>
            <Link href="/wishlist" className="relative flex h-9 w-9 items-center justify-center rounded-xl text-gray-600 transition-all hover:bg-accent-50 hover:text-accent-500 sm:h-10 sm:w-10" aria-label="Wishlist">
              <FiHeart size={20} />
              {wishlistCount > 0 && <span className="absolute -top-0.5 -right-0.5 bg-accent-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold shadow-orange">{wishlistCount}</span>}
            </Link>
            <button onClick={() => setIsCartOpen(true)} className="relative flex h-9 w-9 items-center justify-center rounded-xl text-gray-600 transition-all hover:bg-primary-50 hover:text-primary-600 sm:h-10 sm:w-10" aria-label="Cart">
              <FiShoppingBag size={20} />
              {cartCount > 0 && <span className="absolute -top-0.5 -right-0.5 bg-accent-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold shadow-orange">{cartCount}</span>}
            </button>
          </div>
        </div>
      </div>

      {searchOpen && (
        <div className="border-t bg-white py-4 px-4 shadow-sm">
          <div className="relative max-w-2xl mx-auto">
            <form onSubmit={handleSearch} className="flex gap-0">
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search product names..." className="flex-1 border border-r-0 border-gray-200 rounded-l-xl px-4 py-3 text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100" autoFocus />
              <button type="submit" className="bg-primary-600 text-white px-4 sm:px-6 py-3 rounded-r-xl hover:bg-primary-700 transition-colors font-semibold text-sm">Search</button>
            </form>
            {(suggestions.length > 0 || suggesting) && (
              <div className="absolute left-0 right-0 top-full mt-2 z-50 overflow-hidden rounded-2xl border bg-white shadow-brand-lg">
                {suggesting && suggestions.length === 0 && <div className="px-4 py-3 text-sm text-gray-500">Finding matching gifts...</div>}
                {suggestions.map((product) => (
                  <Link key={product._id} href={`/products/${product.slug}`} onClick={closeSearch} className="flex items-center gap-3 px-4 py-3 hover:bg-primary-50 transition-colors">
                    <img src={product.images?.[0] || '/placeholder.svg'} alt="" className="h-11 w-11 rounded-lg object-cover bg-gray-100" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-900">{product.title}</p>
                      <p className="text-xs font-bold text-primary-600">{formatPrice(getDisplayPrice(product))}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {mobileOpen && (
        <div className="md:hidden border-t bg-white shadow-lg">
          <nav className="flex flex-col py-3">
            {menuItems.map(item => (
              <div key={item.href}>
                <Link href={item.href} onClick={() => setMobileOpen(false)} className="px-5 py-3 text-gray-700 hover:bg-primary-50 hover:text-primary-600 font-medium block transition-colors">{item.label}</Link>
                {item.megaMenu && (
                  <div className="bg-gray-50 px-5 py-3 sm:px-8">
                    <div className="grid grid-cols-2 gap-3">
                      {visibleMegaCollections.map(col => (
                        <Link key={col.href} href={col.href} onClick={() => setMobileOpen(false)} className="group flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm ring-1 ring-gray-100 transition-colors hover:bg-primary-50">
                          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${col.color}`}><FiGift size={18} /></div>
                          <div className="min-w-0"><span className="block truncate text-sm font-semibold text-gray-800 group-hover:text-primary-600">{col.label}</span><span className="text-xs text-gray-400">Explore</span></div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div className="border-t mt-2 pt-2 px-5">
              <Link href="/track-order" onClick={() => setMobileOpen(false)} className="py-3 text-gray-700 hover:text-accent-500 font-medium block text-sm transition-colors">Track Your Order</Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
