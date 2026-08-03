'use client';
import { useEffect, useState } from 'react';
import { FiPlus, FiEdit, FiTrash2 } from 'react-icons/fi';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function AdminBlogsPage() {
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    const res = await fetch('/api/blogs');
    const data = await res.json();
    setBlogs(data.blogs || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleDelete = async (id) => {
    if (!confirm('Delete this blog post?')) return;
    await fetch(`/api/blogs/${id}`, { method: 'DELETE' });
    toast.success('Deleted');
    fetchData();
  };

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center mb-6">
        <h1 className="text-2xl font-bold">Blogs</h1>
        <Link href="/account/manage/blogs/new" className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-white hover:bg-primary-700 sm:w-auto"><FiPlus /> New Post</Link>
      </div>
      <div className="bg-white rounded-xl border overflow-hidden">
        {loading ? <p className="p-6 text-center">Loading...</p> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm">
            <thead><tr className="bg-gray-50 text-left"><th className="p-4">Title</th><th className="p-4">Status</th><th className="p-4">Date</th><th className="p-4">Actions</th></tr></thead>
            <tbody>
              {blogs.map(b => (
                <tr key={b._id} className="border-t hover:bg-gray-50">
                  <td className="p-4 font-medium">{b.title}</td>
                  <td className="p-4"><span className={`px-2 py-1 rounded-full text-xs ${b.isPublished ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>{b.isPublished ? 'Published' : 'Draft'}</span></td>
                  <td className="p-4 text-gray-500">{new Date(b.createdAt).toLocaleDateString()}</td>
                  <td className="p-4 flex gap-2">
                    <Link href={`/account/manage/blogs/${b._id}`} className="text-blue-600"><FiEdit /></Link>
                    <button onClick={() => handleDelete(b._id)} className="text-red-600"><FiTrash2 /></button>
                  </td>
                </tr>
              ))}
              {blogs.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-gray-500">No blog posts</td></tr>}
            </tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}
