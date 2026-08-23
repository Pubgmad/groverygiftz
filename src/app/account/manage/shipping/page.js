'use client';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { FiEdit2, FiPlus, FiTrash2 } from 'react-icons/fi';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand',
  'West Bengal', 'Delhi', 'Jammu & Kashmir', 'Ladakh', 'Puducherry',
];

const blankRates = () => INDIAN_STATES.map((state) => ({ state, shippingCost: state === 'Tamil Nadu' ? 0 : 0, deliveryEstimate: state === 'Tamil Nadu' ? 'Within 8 working days' : '10-15 working days' }));
const emptyTemplate = () => ({ name: '', description: '', rates: blankRates(), isActive: true });

export default function ShippingTemplatesPage() {
  const [templates, setTemplates] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(emptyTemplate());
  const [loading, setLoading] = useState(false);
  const selected = useMemo(() => templates.find((template) => template._id === selectedId), [templates, selectedId]);

  const loadTemplates = () => fetch('/api/shipping-templates?all=true').then(r => r.json()).then(d => setTemplates(d.templates || [])).catch(() => toast.error('Unable to load shipping templates'));

  useEffect(() => { loadTemplates(); }, []);
  useEffect(() => {
    if (!selectedId) return;
    if (selectedId === 'new') return setForm(emptyTemplate());
    if (selected) setForm({ ...emptyTemplate(), ...selected, rates: INDIAN_STATES.map((state) => ({ state, ...(selected.rates || []).find((row) => row.state === state) })) });
  }, [selectedId, selected]);

  const updateRate = (idx, updates) => setForm((prev) => ({ ...prev, rates: prev.rates.map((row, rowIdx) => rowIdx === idx ? { ...row, ...updates } : row) }));

  const saveTemplate = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Template name is required');
    setLoading(true);
    const isEdit = selectedId !== 'new';
    try {
      const res = await fetch(isEdit ? `/api/shipping-templates/${selectedId}` : '/api/shipping-templates', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Unable to save template');
      toast.success('Shipping template saved');
      await loadTemplates();
      setSelectedId(data._id || selectedId);
    } catch (error) {
      toast.error(error.message || 'Unable to save template');
    } finally {
      setLoading(false);
    }
  };

  const deleteTemplate = async () => {
    if (!selectedId || selectedId === 'new') return;
    if (!window.confirm('Delete this shipping template permanently? Products using it will keep their last saved rates.')) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/shipping-templates/${selectedId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Unable to delete template');
      toast.success('Shipping template deleted');
      setSelectedId(null);
      await loadTemplates();
    } catch (error) {
      toast.error(error.message || 'Unable to delete template');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Shipping Templates</h1>
          <p className="mt-1 text-sm text-gray-500">Create reusable state-wise delivery charges for product and variant pricing.</p>
        </div>
        <button type="button" onClick={() => setSelectedId('new')} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 text-sm font-bold text-white sm:w-auto"><FiPlus /> New Template</button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <div className="rounded-2xl border bg-white p-3">
          <div className="mb-3 px-2 py-1">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Saved templates</p>
          </div>
          {templates.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-gray-50 px-3 py-6 text-center text-sm text-gray-500">No shipping templates yet.</div>
          ) : templates.map((template) => (
            <button key={template._id} type="button" onClick={() => setSelectedId(template._id)} className={`mb-2 w-full rounded-xl px-3 py-3 text-left text-sm font-semibold transition ${selectedId === template._id ? 'bg-primary-50 text-primary-700' : 'hover:bg-gray-50'}`}>
              <span className="flex min-w-0 items-center justify-between gap-3">
                <span className="block min-w-0 truncate">{template.name}</span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${template.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{template.isActive ? 'Active' : 'Inactive'}</span>
              </span>
              <span className="mt-1 block text-xs font-normal text-gray-500">Click to edit or check/uncheck active status</span>
            </button>
          ))}
        </div>

        {!selectedId ? (
          <div className="flex min-h-[260px] items-center justify-center rounded-2xl border border-dashed bg-white p-6 text-center sm:p-8">
            <div className="max-w-sm">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-600"><FiEdit2 size={22} /></div>
              <h2 className="font-display text-xl font-bold text-gray-950">Select a template</h2>
              <p className="mt-2 text-sm text-gray-500">Choose a saved shipping template to edit it, or create a new one when needed.</p>
              <button type="button" onClick={() => setSelectedId('new')} className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 text-sm font-bold text-white"><FiPlus /> New Template</button>
            </div>
          </div>
        ) : (
        <form onSubmit={saveTemplate} className="rounded-2xl border bg-white p-4 sm:p-6">
          <div className="mb-5 grid gap-4 md:grid-cols-2">
            <div><label className="mb-1 block text-sm font-medium">Template Name</label><input required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="w-full rounded-lg border px-4 py-2" placeholder="Example: 1 KG - All States" /></div>
            <div><label className="mb-1 block text-sm font-medium">Description</label><input value={form.description || ''} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="w-full rounded-lg border px-4 py-2" placeholder="Optional internal note" /></div>
          </div>
          <label className="mb-5 flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.isActive !== false} onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))} /> Active for product dropdowns</label>

          <div className="space-y-3 md:hidden">
            {form.rates.map((row, idx) => (
              <div key={row.state} className="rounded-xl border bg-gray-50 p-3">
                <div className="mb-3 flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-gray-500">{idx + 1}</span>
                  <p className="min-w-0 break-words text-sm font-bold text-gray-900">{row.state}</p>
                </div>
                <div className="grid gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-500">Price</label>
                    <input type="number" min="0" value={row.shippingCost ?? ''} onChange={e => updateRate(idx, { shippingCost: e.target.value })} className="w-full rounded-lg border bg-white px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-500">Delivery Estimate</label>
                    <input value={row.deliveryEstimate || ''} onChange={e => updateRate(idx, { deliveryEstimate: e.target.value })} className="w-full rounded-lg border bg-white px-3 py-2 text-sm" placeholder="Within 8 working days" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-xl border md:block">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-gray-50 text-left text-gray-600"><tr><th className="p-3">S.No</th><th className="p-3">State</th><th className="p-3">Price</th><th className="p-3">Delivery Estimate</th></tr></thead>
              <tbody>
                {form.rates.map((row, idx) => (
                  <tr key={row.state} className="border-t">
                    <td className="p-3 text-gray-500">{idx + 1}</td>
                    <td className="p-3 font-semibold text-gray-900">{row.state}</td>
                    <td className="p-3"><input type="number" min="0" value={row.shippingCost ?? ''} onChange={e => updateRate(idx, { shippingCost: e.target.value })} className="w-28 rounded-lg border px-3 py-2" /></td>
                    <td className="p-3"><input value={row.deliveryEstimate || ''} onChange={e => updateRate(idx, { deliveryEstimate: e.target.value })} className="w-full rounded-lg border px-3 py-2" placeholder="Within 8 working days" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-between">
            {selectedId === 'new' ? (
              <button type="button" onClick={() => setForm(emptyTemplate())} disabled={loading} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold text-gray-600 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">Clear new template</button>
            ) : (
              <button type="button" onClick={deleteTemplate} disabled={loading} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-3 text-sm font-bold text-red-600 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"><FiTrash2 /> Delete</button>
            )}
            <button disabled={loading} className="w-full rounded-xl bg-primary-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-60 sm:w-auto">{loading ? 'Saving...' : 'Save Template'}</button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}