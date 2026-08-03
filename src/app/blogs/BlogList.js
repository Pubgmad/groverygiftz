'use client';
import { useState } from 'react';
import Link from 'next/link';

const ITEMS_PER_PAGE = 6;

export default function BlogList({ blogs }) {
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const visible = blogs.slice(0, visibleCount);
  const hasMore = visibleCount < blogs.length;

  return (
    <>
      <div className="grid md:grid-cols-2 gap-6">
        {visible.map(blog => (
          <Link key={blog._id} href={`/blogs/${blog.slug}`} className="group bg-white rounded-2xl overflow-hidden border card-hover">
            {blog.featuredImage && (
              <div className="aspect-video overflow-hidden">
                <img src={blog.featuredImage} alt={blog.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              </div>
            )}
            <div className="p-6">
              <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
                <span>{new Date(blog.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                {blog.author && <span>By {blog.author}</span>}
              </div>
              <h2 className="font-bold text-lg group-hover:text-primary-600 transition-colors mb-2">{blog.title}</h2>
              <p className="text-gray-600 text-sm line-clamp-3">{blog.excerpt}</p>
            </div>
          </Link>
        ))}
      </div>
      {hasMore && (
        <div className="text-center mt-8">
          <button onClick={() => setVisibleCount(c => c + ITEMS_PER_PAGE)} className="btn-outline">
            Load More
          </button>
        </div>
      )}
    </>
  );
}
