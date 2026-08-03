export const dynamic = 'force-dynamic';
import dbConnect from '@/lib/db';
import Blog from '@/models/Blog';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import { notFound } from 'next/navigation';

export default async function BlogDetailPage({ params }) {
  await dbConnect();
  const blog = await Blog.findOne({ slug: params.slug, isPublished: true }).lean();
  if (!blog) notFound();

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <Breadcrumbs items={[{ label: 'Blogs', href: '/blogs' }, { label: blog.title }]} />
      {blog.featuredImage && (
        <div className="aspect-video rounded-2xl overflow-hidden mb-8">
          <img src={blog.featuredImage} alt={blog.title} className="w-full h-full object-cover" />
        </div>
      )}
      <p className="text-sm text-gray-400 mb-2">{new Date(blog.createdAt).toLocaleDateString()} {blog.author && `• ${blog.author}`}</p>
      <h1 className="text-3xl md:text-4xl font-display font-bold mb-8">{blog.title}</h1>
      <div className="prose max-w-none overflow-x-auto prose-img:max-w-full prose-table:block prose-table:overflow-x-auto" dangerouslySetInnerHTML={{ __html: blog.content }} />
    </div>
  );
}
