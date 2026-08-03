'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import ImageUploader from '@/components/admin/ImageUploader';

export default function AdminBlogForm({ params }) {
  const isEdit = params?.id && params.id !== 'new';
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', excerpt: '', featuredImage: '', author: '', tags: '', isPublished: false });

  useEffect(() => {
    if (isEdit) {
      fetch(`/api/blogs/${params.id}`).then(r => r.json()).then(d => {
        setForm({ title: d.title || '', content: d.content || '', excerpt: d.excerpt || '', featuredImage: d.featuredImage || '', author: d.author || '', tags: (d.tags || []).join(', '), isPublished: d.isPublished || false });
      });
    }
  }, [isEdit, params?.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const body = { ...form, tags: form.tags.split(',').map(t => t.trim()).filter(Boolean) };
    const url = isEdit ? `/api/blogs/${params.id}` : '/api/blogs';
    const method = isEdit ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    setLoading(false);
    if (res.ok) { toast.success(isEdit ? 'Updated!' : 'Created!'); router.push('/account/manage/blogs'); }
    else toast.error('Failed');
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{isEdit ? 'Edit Blog Post' : 'New Blog Post'}</h1>
      <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
        <div className="bg-white p-6 rounded-xl border space-y-4">
          <input required placeholder="Post Title" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
            className="w-full border rounded-lg px-4 py-3 text-lg font-semibold focus:outline-none focus:border-primary-500" />
          <textarea placeholder="Write your blog content (HTML supported)" value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
            className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:border-primary-500 font-mono text-sm" rows={15} />
          <textarea placeholder="Excerpt (short summary)" value={form.excerpt} onChange={e => setForm(p => ({ ...p, excerpt: e.target.value }))}
            className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:border-primary-500" rows={2} />
          <ImageUploader images={form.featuredImage ? [form.featuredImage] : []} onChange={imgs => setForm(p => ({ ...p, featuredImage: imgs[0] || '' }))} />
          <div className="grid md:grid-cols-2 gap-4">
            <input placeholder="Author" value={form.author} onChange={e => setForm(p => ({ ...p, author: e.target.value }))} className="border rounded-lg px-4 py-2 focus:outline-none focus:border-primary-500" />
            <input placeholder="Tags (comma separated)" value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} className="border rounded-lg px-4 py-2 focus:outline-none focus:border-primary-500" />
          </div>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.isPublished} onChange={e => setForm(p => ({ ...p, isPublished: e.target.checked }))} /> Published</label>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="submit" disabled={loading} className="w-full sm:w-auto bg-primary-600 text-white px-6 sm:px-8 py-3 rounded-lg font-semibold hover:bg-primary-700">{loading ? 'Saving...' : isEdit ? 'Update' : 'Publish'}</button>
          <button type="button" onClick={() => router.push('/account/manage/blogs')} className="w-full sm:w-auto px-6 sm:px-8 py-3 border rounded-lg hover:bg-gray-50">Cancel</button>
        </div>
      </form>
    </div>
  );
}
