'use client';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

const pageTypes = [
  { type: 'about', title: 'About Us' },
  { type: 'privacy-policy', title: 'Privacy Policy' },
  { type: 'terms-conditions', title: 'Terms & Conditions' },
  { type: 'shipping-policy', title: 'Shipping Policy' },
  { type: 'refund-policy', title: 'Cancellation & Refund Policy' },
];

export default function AdminPagesPage() {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [content, setContent] = useState('');

  useEffect(() => {
    fetch('/api/pages').then(r => r.json()).then(d => { setPages(d.pages || []); setLoading(false); });
  }, []);

  const getPage = (type) => pages.find(p => p.type === type || p.slug === type);

  const handleSave = async () => {
    const existing = getPage(editing);
    const url = existing ? `/api/pages/${existing._id}` : '/api/pages';
    const method = existing ? 'PUT' : 'POST';
    const pageType = pageTypes.find(p => p.type === editing);
    const body = { title: pageType.title, slug: editing, type: editing, content };

    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.ok) {
      toast.success('Page saved!');
      const updated = await res.json();
      setPages(prev => {
        const idx = prev.findIndex(p => p._id === updated._id);
        if (idx >= 0) { const n = [...prev]; n[idx] = updated; return n; }
        return [...prev, updated];
      });
      setEditing(null);
    } else toast.error('Failed');
  };

  const startEdit = (type) => {
    const page = getPage(type);
    setContent(page?.content || '');
    setEditing(type);
  };

  if (loading) return <div className="text-center py-12">Loading...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Pages</h1>

      {editing ? (
        <div className="bg-white rounded-xl border p-4 sm:p-6">
          <h2 className="font-bold text-lg mb-4">{pageTypes.find(p => p.type === editing)?.title}</h2>
          <textarea value={content} onChange={e => setContent(e.target.value)}
            className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:border-primary-500 font-mono text-sm" rows={20}
            placeholder="Write page content (HTML supported)" />
          <div className="flex flex-col gap-3 mt-4 sm:flex-row">
            <button onClick={handleSave} className="w-full sm:w-auto bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700">Save</button>
            <button onClick={() => setEditing(null)} className="w-full sm:w-auto px-6 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm">
            <thead><tr className="bg-gray-50 text-left"><th className="p-4">Page</th><th className="p-4">Status</th><th className="p-4">Action</th></tr></thead>
            <tbody>
              {pageTypes.map(pt => {
                const page = getPage(pt.type);
                return (
                  <tr key={pt.type} className="border-t hover:bg-gray-50">
                    <td className="p-4 font-medium">{pt.title}</td>
                    <td className="p-4"><span className={`px-2 py-1 rounded-full text-xs ${page ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>{page ? 'Published' : 'Not set'}</span></td>
                    <td className="p-4"><button onClick={() => startEdit(pt.type)} className="text-primary-600 hover:underline text-sm">Edit</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        </div>
      )}
    </div>
  );
}
