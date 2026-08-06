export const dynamic = 'force-dynamic';
import dbConnect from '@/lib/db';
import Blog from '@/models/Blog';
import Settings from '@/models/Settings';
import Link from 'next/link';
import { FiArrowRight, FiInstagram, FiMail } from 'react-icons/fi';
import BlogList from './BlogList';

export default async function BlogsPage() {
  await dbConnect();
  const [blogs, settings] = await Promise.all([
    Blog.find({ isPublished: true }).sort({ createdAt: -1 }).lean(),
    Settings.findOne().lean(),
  ]);
  const data = JSON.parse(JSON.stringify(blogs));
  const instagram = settings?.socialLinks?.instagram || 'https://www.instagram.com/groverygiftz?igsh=dGNpbHlybWI0cjNy';
  const email = settings?.email || 'Groverygiftz@gmail.com';
  const promoTitle = settings?.promoBannerTitle || 'Discover personalized gifts made with love';
  const promoSubtitle = settings?.promoBannerSubtitle || 'Explore photo frames, LED lamps, engravings and thoughtful gifts for every occasion.';
  const promoButtonText = settings?.promoBannerButtonText || 'Shop now';
  const promoButtonLink = settings?.promoBannerButtonLink || '/shop';
  const promoImage = settings?.promoBannerImage || '';

  return (
    <div className="bg-white">
      <section className="border-b bg-gradient-to-br from-orange-50 via-white to-blue-50/60">
        <div className="max-w-7xl mx-auto px-4 py-10 sm:py-14">
          <p className="text-xs font-extrabold uppercase tracking-[0.28em] text-accent-600">Gift ideas & guides</p>
          <h1 className="mt-3 text-3xl md:text-5xl font-display font-extrabold tracking-tight text-gray-950">Blogs</h1>
          <p className="mt-3 max-w-2xl text-sm sm:text-base text-gray-600">Helpful gifting ideas, personalization tips and occasion guides from GroveryGiftz.</p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 py-10 sm:py-12">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div>
            {data.length === 0 ? (
              <div className="rounded-2xl border bg-gray-50 px-6 py-14 text-center text-gray-500">No blog posts yet. Check back soon!</div>
            ) : (
              <BlogList blogs={data} />
            )}
          </div>

          <aside className="space-y-5 lg:sticky lg:top-28 lg:self-start">
            <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
              <div className="relative min-h-[220px] p-6 text-white">
                {promoImage ? (
                  <img src={promoImage} alt={promoTitle} className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-accent-500 via-orange-500 to-primary-700" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-black/10" />
                <div className="relative z-10 flex min-h-[172px] flex-col justify-end">
                  <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-orange-100">Featured offer</p>
                  <h2 className="mt-2 text-2xl font-display font-extrabold leading-tight drop-shadow">{promoTitle}</h2>
                  {promoSubtitle && <p className="mt-2 text-sm text-white/90 line-clamp-3">{promoSubtitle}</p>}
                  <Link href={promoButtonLink} className="mt-4 inline-flex w-fit items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-extrabold text-primary-700 shadow-lg transition hover:bg-orange-50">
                    {promoButtonText} <FiArrowRight size={16} />
                  </Link>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border bg-gray-950 p-6 text-white shadow-sm">
              <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-accent-300">Follow GroveryGiftz</p>
              <h3 className="mt-2 text-xl font-display font-extrabold">See real gift stories and new arrivals</h3>
              <p className="mt-2 text-sm text-gray-300">Follow us on Instagram for product videos, customer ideas and latest personalized gift collections.</p>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row lg:flex-col">
                <a href={instagram} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-full bg-accent-500 px-5 py-3 text-sm font-extrabold text-white transition hover:bg-accent-600">
                  <FiInstagram size={18} /> Instagram
                </a>
                <a href={`mailto:${email}`} className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-5 py-3 text-sm font-extrabold text-white transition hover:bg-white/10">
                  <FiMail size={18} /> Email us
                </a>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
