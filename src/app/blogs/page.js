export const dynamic = 'force-dynamic';
import dbConnect from '@/lib/db';
import Blog from '@/models/Blog';
import Settings from '@/models/Settings';
import Link from 'next/link';
import { FiInstagram } from 'react-icons/fi';
import BlogList from './BlogList';

export default async function BlogsPage() {
  await dbConnect();
  const [blogs, settings] = await Promise.all([
    Blog.find({ isPublished: true }).sort({ createdAt: -1 }).lean(),
    Settings.findOne().lean(),
  ]);
  const data = JSON.parse(JSON.stringify(blogs));
  const instagram = settings?.socialLinks?.instagram || 'https://www.instagram.com/groverygiftz?igsh=dGNpbHlybWI0cjNy';

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <h1 className="text-3xl md:text-4xl font-display font-bold mb-8">Blogs</h1>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Blog Posts */}
        <div className="lg:col-span-2">
          {data.length === 0 ? (
            <p className="text-center py-12 text-gray-500">No blog posts yet. Check back soon!</p>
          ) : (
            <BlogList blogs={data} />
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-8">
          {/* Promotional Banner */}
          <div className="rounded-2xl overflow-hidden">
            <div className="bg-gradient-to-br from-primary-500 to-accent-500 p-8 text-center text-white">
              <h3 className="text-xl font-display font-bold mb-3">Promotional Banner</h3>
              <Link href="/shop" className="inline-block bg-white text-primary-600 px-6 py-2 rounded-lg font-semibold hover:bg-gray-100 transition-colors text-sm">
                Shop Now
              </Link>
            </div>
          </div>

          {/* Social Images */}
          <div>
            <h3 className="font-bold text-lg mb-4">Follow Us</h3>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="aspect-square rounded-lg bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center">
                  <span className="text-2xl">📸</span>
                </div>
              ))}
            </div>
            <div className="flex gap-4 mt-4">
              <a href={instagram} target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-primary-600 transition-colors"><FiInstagram size={20} /></a>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
