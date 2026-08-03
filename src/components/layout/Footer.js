import Link from 'next/link';
import Image from 'next/image';
import { FiInstagram, FiYoutube, FiMail, FiPhone, FiMapPin, FiPackage } from 'react-icons/fi';
import Newsletter from './Newsletter';
import dbConnect from '@/lib/db';
import Settings from '@/models/Settings';

export default async function Footer() {
  await dbConnect();
  const settings = await Settings.findOne().lean();

  const contactPhone = settings?.phone || '+91 99945 49781';
  const contactEmail = settings?.email || 'Groverygiftz@gmail.com';
  const locationText = settings?.address || '126, 3rd St, V.C.K.N.Layout, Sivananda Colony, Tatabad, Coimbatore, Tamil Nadu 641012';
  const timingText = settings?.timings || '11 am to 7 pm';
  const instagram = settings?.socialLinks?.instagram || 'https://www.instagram.com/groverygiftz?igsh=dGNpbHlybWI0cjNy';
  const youtube = settings?.socialLinks?.youtube || '';

  return (
    <footer className="bg-gray-950 text-gray-400">
      {/* Brand gradient top border */}
      <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #2456D8 0%, #F47920 40%, #2456D8 70%, #F47920 100%)' }} />

      <Newsletter
        badge={settings?.newsletterBadge}
        title={settings?.newsletterTitle}
        subtitle={settings?.newsletterSubtitle}
        placeholder={settings?.newsletterPlaceholder}
      />

      <div className="max-w-7xl mx-auto px-4 py-14">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">

          {/* Brand column */}
          <div>
            <Link href="/" className="flex items-center gap-2.5 mb-4">
              <Image src="/logo.svg" alt="GroveryGiftz" width={36} height={44} />
              <div className="leading-none">
                <span className="text-lg font-display font-bold text-white">Grovery</span>
                <span className="text-lg font-display font-bold text-accent-400">Giftz</span>
              </div>
            </Link>
            <p className="text-sm leading-relaxed mb-5">
              We understand that gifts are more than just material objects; they&apos;re a representation of emotions, relationships, and unforgettable moments.
            </p>
            <div className="space-y-2 text-sm">
              <a href={`tel:${contactPhone.replace(/\s+/g, '')}`}
                 className="flex items-center gap-2 hover:text-accent-400 transition-colors">
                <FiPhone size={14} /> {contactPhone}
              </a>
              <a href={`mailto:${contactEmail}`}
                 className="flex items-center gap-2 hover:text-accent-400 transition-colors">
                <FiMail size={14} /> {contactEmail}
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-white font-semibold mb-5 text-sm uppercase tracking-widest">Quick Links</h4>
            <ul className="space-y-2.5 text-sm">
              {[
                { label: 'Home', href: '/' },
                { label: 'About Us', href: '/about' },
                { label: 'All Products', href: '/shop' },
                { label: 'Contact Us', href: '/contact' },
                { label: 'Blogs', href: '/blogs' },
              ].map(l => (
                <li key={l.href}>
                  <Link href={l.href} className="hover:text-accent-400 transition-colors hover:pl-1 block">{l.label}</Link>
                </li>
              ))}
              <li>
                <Link href="/track-order"
                  className="flex items-center gap-1.5 hover:text-accent-400 transition-colors font-medium text-accent-300">
                  <FiPackage size={13} /> Track Your Order
                </Link>
              </li>
            </ul>
          </div>

          {/* Policies */}
          <div>
            <h4 className="text-white font-semibold mb-5 text-sm uppercase tracking-widest">Policies</h4>
            <ul className="space-y-2.5 text-sm">
              {[
                { label: 'Privacy Policy', href: '/policies/privacy-policy' },
                { label: 'Terms and Conditions', href: '/policies/terms-conditions' },
                { label: 'Shipping Policy', href: '/policies/shipping-policy' },
                { label: 'Cancellation & Refund', href: '/policies/refund-policy' },
              ].map(l => (
                <li key={l.href}>
                  <Link href={l.href} className="hover:text-accent-400 transition-colors hover:pl-1 block">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Location */}
          <div>
            <h4 className="text-white font-semibold mb-5 text-sm uppercase tracking-widest">Location</h4>
            <div className="flex items-start gap-2 text-sm mb-3">
              <FiMapPin size={14} className="mt-0.5 flex-shrink-0 text-accent-400" />
              <span>{locationText}</span>
            </div>
            <p className="text-sm mb-5">
              <span className="text-accent-400 font-medium">Timing:</span> {timingText}
            </p>
            <div className="flex gap-3">
              <a href={instagram} target="_blank" rel="noopener noreferrer"
                 className="w-9 h-9 rounded-xl bg-gray-800 flex items-center justify-center hover:bg-accent-500 hover:shadow-orange transition-all duration-200 group">
                <FiInstagram size={16} className="text-gray-300 group-hover:text-white" />
              </a>
              {youtube && (
                <a href={youtube} target="_blank" rel="noopener noreferrer"
                   className="w-9 h-9 rounded-xl bg-gray-800 flex items-center justify-center hover:bg-red-600 hover:shadow-sm transition-all duration-200 group">
                  <FiYoutube size={16} className="text-gray-300 group-hover:text-white" />
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-gray-800 mt-10 pt-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <p>&copy; {new Date().getFullYear()} GroveryGiftz. All rights reserved.</p>
              <Link href="/search" className="hover:text-accent-400 transition-colors">Search</Link>
            </div>
            <div className="flex items-center gap-2">
              {[{label:'VISA',cls:'bg-blue-900 text-blue-200'},{label:'MC',cls:'bg-red-900 text-red-200'},{label:'UPI',cls:'bg-green-900 text-green-200'},{label:'RuPay',cls:'bg-indigo-900 text-indigo-200'},{label:'Cashfree',cls:'bg-accent-900 text-accent-200'}].map(m => (
                <div key={m.label} className={`${m.cls} rounded-lg px-2.5 py-1 text-xs font-bold`}>{m.label}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
