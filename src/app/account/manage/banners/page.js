'use client';
import { useEffect, useState } from 'react';
import { FiPlus, FiEdit, FiTrash2, FiX } from 'react-icons/fi';
import toast from 'react-hot-toast';
import ImageUploader from '@/components/admin/ImageUploader';

export default function AdminBannersPage() {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: '', subtitle: '', image: '', link: '/', buttonText: 'Shop Now', order: 0, isActive: true });

  const fetchData = async () => {
    const res = await fetch('/api/banners');
    const data = await res.json();
    setBanners(data.banners || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const url = editing ? `/api/banners/${editing}` : '/api/banners';
    const method = editing ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    if (res.ok) { toast.success(editing ? 'Updated!' : 'Created!'); resetForm(); fetchData(); }
    else toast.error('Failed');
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this banner?')) return;
    await fetch(`/api/banners/${id}`, { method: 'DELETE' });
    toast.success('Deleted');
    fetchData();
  };

  const startEdit = (b) => {
    setEditing(b._id);
    setForm({ title: b.title || '', subtitle: b.subtitle || '', image: b.image || '', link: b.link || '/', buttonText: b.buttonText || 'Shop Now', order: b.order, isActive: b.isActive });
    setShowForm(true);
  };

  const resetForm = () => { setShowForm(false); setEditing(null); setForm({ title: '', subtitle: '', image: '', link: '/', buttonText: 'Shop Now', order: 0, isActive: true }); };

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center mb-6">
        <h1 className="text-2xl font-bold">Banners</h1>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="w-full justify-center sm:w-auto bg-primary-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-primary-700"><FiPlus /> Add Banner</button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border p-4 sm:p-6 mb-6">
          <div className="flex justify-between items-center mb-4"><h2 className="font-bold text-lg">{editing ? 'Edit' : 'New'} Banner</h2><button onClick={resetForm}><FiX /></button></div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input required placeholder="Title" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="w-full border rounded-lg px-4 py-2" />
            <input placeholder="Subtitle" value={form.subtitle} onChange={e => setForm(p => ({ ...p, subtitle: e.target.value }))} className="w-full border rounded-lg px-4 py-2" />
            <ImageUploader images={form.image ? [form.image] : []} onChange={imgs => setForm(p => ({ ...p, image: imgs[0] || '' }))} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <input placeholder="Link URL" value={form.link} onChange={e => setForm(p => ({ ...p, link: e.target.value }))} className="border rounded-lg px-4 py-2" />
              <input placeholder="Button Text" value={form.buttonText} onChange={e => setForm(p => ({ ...p, buttonText: e.target.value }))} className="border rounded-lg px-4 py-2" />
              <input type="number" placeholder="Order" value={form.order} onChange={e => setForm(p => ({ ...p, order: parseInt(e.target.value) || 0 }))} className="border rounded-lg px-4 py-2" />
            </div>
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.isActive} onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))} /> Active</label>
            <button type="submit" className="w-full sm:w-auto bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700">{editing ? 'Update' : 'Create'}</button>
          </form>
        </div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {banners.map(b => (
          <div key={b._id} className="bg-white rounded-xl border overflow-hidden">
            <div className="aspect-[2/1] bg-gray-100">{b.image && <img src={b.image} alt={b.title} className="w-full h-full object-cover" />}</div>
            <div className="p-4">
              <h3 className="font-bold">{b.title}</h3>
              <p className="text-sm text-gray-500">{b.subtitle}</p>
              <div className="flex gap-2 mt-3">
                <button onClick={() => startEdit(b)} className="text-blue-600 text-sm"><FiEdit /></button>
                <button onClick={() => handleDelete(b._id)} className="text-red-600 text-sm"><FiTrash2 /></button>
              </div>
            </div>
          </div>
        ))}
        {!loading && banners.length === 0 && <p className="text-gray-500 col-span-full text-center py-6">No banners</p>}
      </div>
    </div>
  );
}
