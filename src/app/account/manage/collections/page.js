'use client';
import { useEffect, useState } from 'react';
import { FiPlus, FiEdit, FiTrash2, FiX } from 'react-icons/fi';
import toast from 'react-hot-toast';
import ImageUploader from '@/components/admin/ImageUploader';

export default function AdminCollectionsPage() {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', image: '', order: 0, isFeatured: false, isActive: true });

  const fetchData = async () => {
    const res = await fetch('/api/collections');
    const data = await res.json();
    setCollections(data.collections || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const url = editing ? `/api/collections/${editing}` : '/api/collections';
    const method = editing ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    if (res.ok) {
      toast.success(editing ? 'Updated!' : 'Created!');
      resetForm();
      fetchData();
    } else toast.error('Failed');
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this collection?')) return;
    await fetch(`/api/collections/${id}`, { method: 'DELETE' });
    toast.success('Deleted');
    fetchData();
  };

  const startEdit = (col) => {
    setEditing(col._id);
    setForm({ name: col.name, description: col.description || '', image: col.image || '', order: col.order, isFeatured: col.isFeatured, isActive: col.isActive });
    setShowForm(true);
  };

  const resetForm = () => {
    setShowForm(false);
    setEditing(null);
    setForm({ name: '', description: '', image: '', order: 0, isFeatured: false, isActive: true });
  };

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center mb-6">
        <h1 className="text-2xl font-bold">Collections</h1>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-white hover:bg-primary-700 sm:w-auto">
          <FiPlus /> Add Collection
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border p-4 sm:p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold text-lg">{editing ? 'Edit' : 'New'} Collection</h2>
            <button onClick={resetForm}><FiX /></button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input required placeholder="Collection name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:border-primary-500" />
            <textarea placeholder="Description" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:border-primary-500" rows={3} />
            <ImageUploader images={form.image ? [form.image] : []} onChange={imgs => setForm(p => ({ ...p, image: imgs[0] || '' }))} />
            <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
              <input type="number" placeholder="Display order" value={form.order} onChange={e => setForm(p => ({ ...p, order: parseInt(e.target.value) || 0 }))}
                className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:border-primary-500 sm:w-32" />
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.isFeatured} onChange={e => setForm(p => ({ ...p, isFeatured: e.target.checked }))} /> Featured</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.isActive} onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))} /> Active</label>
            </div>
            <button type="submit" className="w-full rounded-lg bg-primary-600 px-6 py-2 text-white hover:bg-primary-700 sm:w-auto">{editing ? 'Update' : 'Create'}</button>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl border overflow-hidden">
        {loading ? <p className="p-6 text-center">Loading...</p> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm">
            <thead><tr className="bg-gray-50 text-left"><th className="p-4">Image</th><th className="p-4">Name</th><th className="p-4">Order</th><th className="p-4">Status</th><th className="p-4">Actions</th></tr></thead>
            <tbody>
              {collections.map(col => (
                <tr key={col._id} className="border-t hover:bg-gray-50">
                  <td className="p-4"><div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden">{col.image && <img src={col.image} alt="" className="w-full h-full object-cover" />}</div></td>
                  <td className="p-4 font-medium">{col.name}</td>
                  <td className="p-4">{col.order}</td>
                  <td className="p-4"><span className={`px-2 py-1 rounded-full text-xs ${col.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{col.isActive ? 'Active' : 'Inactive'}</span></td>
                  <td className="p-4"><div className="flex gap-2"><button onClick={() => startEdit(col)} className="text-blue-600"><FiEdit /></button><button onClick={() => handleDelete(col._id)} className="text-red-600"><FiTrash2 /></button></div></td>
                </tr>
              ))}
              {collections.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-gray-500">No collections</td></tr>}
            </tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}
