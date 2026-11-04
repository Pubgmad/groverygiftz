'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FiX } from 'react-icons/fi';

const emptyItem = () => ({ productId: '', variant: '', quantity: 1, price: '', instructions: '' });

export default function CreateWhatsAppOrderModal({ open, onClose, onCreated }) {
  const [products, setProducts] = useState([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    orderSource: 'whatsapp',
    customerName: '',
    phone: '',
    whatsappNumber: '',
    email: '',
    line1: '',
    line2: '',
    landmark: '',
    district: '',
    city: '',
    state: 'Tamil Nadu',
    pincode: '',
    total: '',
    shippingCost: '0',
    advancePayment: '',
    paymentMethod: 'UPI',
    paymentReference: '',
    paymentVerified: false,
    previewRequired: 'yes',
    expectedDispatchDate: '',
    internalNotes: '',
    items: [emptyItem()],
  });

  useEffect(() => {
    if (!open) return;
    fetch('/api/products?all=true&limit=100', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setProducts(d.products || []))
      .catch(() => toast.error('Unable to load products'));
  }, [open]);

  if (!open) return null;

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const setItem = (index, key, value) => {
    setForm((prev) => {
      const items = [...prev.items];
      items[index] = { ...items[index], [key]: value };
      if (key === 'productId') {
        const product = products.find((p) => String(p._id) === String(value));
        const price = product?.salePrice > 0 ? product.salePrice : product?.regularPrice;
        items[index].price = price != null ? String(price) : '';
        items[index].variant = '';
      }
      return { ...prev, items };
    });
  };

  const selectedProduct = (id) => products.find((p) => String(p._id) === String(id));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        orderSource: form.orderSource,
        customerName: form.customerName,
        phone: form.phone,
        whatsappNumber: form.whatsappNumber || form.phone,
        email: form.email,
        line1: form.line1,
        line2: form.line2,
        landmark: form.landmark,
        district: form.district,
        city: form.city,
        state: form.state,
        pincode: form.pincode,
        shippingCost: Number(form.shippingCost) || 0,
        total: form.total === '' ? undefined : Number(form.total),
        advancePayment: Number(form.advancePayment) || 0,
        paymentMethod: form.paymentMethod,
        paymentReference: form.paymentReference,
        paymentVerified: form.paymentVerified,
        previewRequired: form.previewRequired === 'yes',
        expectedDispatchDate: form.expectedDispatchDate || undefined,
        internalNotes: form.internalNotes,
        items: form.items.map((item) => ({
          productId: item.productId,
          variant: item.variant,
          quantity: Number(item.quantity) || 1,
          price: item.price === '' ? undefined : Number(item.price),
          customizationInstructions: item.instructions,
        })),
      };
      const res = await fetch('/api/admin/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create order');
      toast.success(`Created ${data.order.orderNumber}`);
      onCreated?.(data.order);
      onClose?.();
    } catch (err) {
      toast.error(err.message || 'Create failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="w-full max-w-3xl max-h-[92dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-4 py-3 sm:px-6">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Create WhatsApp Order</h2>
            <p className="text-xs text-gray-500">Creates a G… order ID. Advance does not auto-verify without checkbox.</p>
          </div>
          <button type="button" onClick={onClose} className="min-h-[44px] min-w-[44px] rounded-xl border p-2" aria-label="Close">
            <FiX size={18} />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4 p-4 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold">Source
              <select value={form.orderSource} onChange={(e) => setField('orderSource', e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2.5">
                <option value="whatsapp">WhatsApp</option>
                <option value="instagram">Instagram</option>
              </select>
            </label>
            <label className="text-sm font-semibold">Preview required
              <select value={form.previewRequired} onChange={(e) => setField('previewRequired', e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2.5">
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </label>
            <label className="text-sm font-semibold sm:col-span-2">Customer name
              <input required value={form.customerName} onChange={(e) => setField('customerName', e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2.5" />
            </label>
            <label className="text-sm font-semibold">Phone
              <input required value={form.phone} onChange={(e) => setField('phone', e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2.5" />
            </label>
            <label className="text-sm font-semibold">WhatsApp
              <input value={form.whatsappNumber} onChange={(e) => setField('whatsappNumber', e.target.value)} placeholder="Same as phone if empty" className="mt-1 w-full rounded-xl border px-3 py-2.5" />
            </label>
            <label className="text-sm font-semibold sm:col-span-2">Address line 1
              <input required value={form.line1} onChange={(e) => setField('line1', e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2.5" />
            </label>
            <label className="text-sm font-semibold">Line 2
              <input value={form.line2} onChange={(e) => setField('line2', e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2.5" />
            </label>
            <label className="text-sm font-semibold">Landmark
              <input value={form.landmark} onChange={(e) => setField('landmark', e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2.5" />
            </label>
            <label className="text-sm font-semibold">District
              <input value={form.district} onChange={(e) => setField('district', e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2.5" />
            </label>
            <label className="text-sm font-semibold">City
              <input required value={form.city} onChange={(e) => setField('city', e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2.5" />
            </label>
            <label className="text-sm font-semibold">State
              <input required value={form.state} onChange={(e) => setField('state', e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2.5" />
            </label>
            <label className="text-sm font-semibold">Pincode
              <input required value={form.pincode} onChange={(e) => setField('pincode', e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2.5" />
            </label>
            <label className="text-sm font-semibold">Expected dispatch
              <input type="date" value={form.expectedDispatchDate} onChange={(e) => setField('expectedDispatchDate', e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2.5" />
            </label>
          </div>

          <div className="space-y-3 rounded-xl border bg-gray-50 p-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900">Products</h3>
              <button type="button" className="text-sm font-semibold text-primary-700" onClick={() => setForm((p) => ({ ...p, items: [...p.items, emptyItem()] }))}>
                + Add item
              </button>
            </div>
            {form.items.map((item, index) => {
              const product = selectedProduct(item.productId);
              const variants = (product?.variants || []).flatMap((v) => (v.options || []).map((o) => `${v.name}: ${o.label}`));
              return (
                <div key={index} className="grid gap-2 rounded-xl border bg-white p-3 sm:grid-cols-2">
                  <label className="text-sm font-semibold sm:col-span-2">Product
                    <select required value={item.productId} onChange={(e) => setItem(index, 'productId', e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2.5">
                      <option value="">Select product</option>
                      {products.map((p) => (
                        <option key={p._id} value={p._id}>{p.title}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm font-semibold">Variant / size
                    {variants.length ? (
                      <select value={item.variant} onChange={(e) => setItem(index, 'variant', e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2.5">
                        <option value="">No variant</option>
                        {variants.map((v) => <option key={v} value={v}>{v}</option>)}
                      </select>
                    ) : (
                      <input value={item.variant} onChange={(e) => setItem(index, 'variant', e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2.5" />
                    )}
                  </label>
                  <label className="text-sm font-semibold">Qty
                    <input type="number" min="1" value={item.quantity} onChange={(e) => setItem(index, 'quantity', e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2.5" />
                  </label>
                  <label className="text-sm font-semibold">Unit price
                    <input type="number" min="0" step="0.01" value={item.price} onChange={(e) => setItem(index, 'price', e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2.5" />
                  </label>
                  <label className="text-sm font-semibold sm:col-span-2">Customization instructions
                    <textarea value={item.instructions} onChange={(e) => setItem(index, 'instructions', e.target.value)} rows={2} className="mt-1 w-full rounded-xl border px-3 py-2.5" />
                  </label>
                </div>
              );
            })}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold">Total amount (optional override)
              <input type="number" min="0" step="0.01" value={form.total} onChange={(e) => setField('total', e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2.5" />
            </label>
            <label className="text-sm font-semibold">Shipping cost
              <input type="number" min="0" step="0.01" value={form.shippingCost} onChange={(e) => setField('shippingCost', e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2.5" />
            </label>
            <label className="text-sm font-semibold">Advance payment
              <input type="number" min="0" step="0.01" value={form.advancePayment} onChange={(e) => setField('advancePayment', e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2.5" />
            </label>
            <label className="text-sm font-semibold">Payment method
              <input value={form.paymentMethod} onChange={(e) => setField('paymentMethod', e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2.5" />
            </label>
            <label className="text-sm font-semibold">Payment reference
              <input value={form.paymentReference} onChange={(e) => setField('paymentReference', e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2.5" />
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold pt-6">
              <input type="checkbox" checked={form.paymentVerified} onChange={(e) => setField('paymentVerified', e.target.checked)} />
              Mark advance verified
            </label>
            <label className="text-sm font-semibold sm:col-span-2">Internal notes
              <textarea value={form.internalNotes} onChange={(e) => setField('internalNotes', e.target.value)} rows={2} className="mt-1 w-full rounded-xl border px-3 py-2.5" />
            </label>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className="min-h-[44px] rounded-xl border px-4 py-2.5 font-semibold">Cancel</button>
            <button type="submit" disabled={saving} className="min-h-[44px] rounded-xl bg-primary-600 px-4 py-2.5 font-semibold text-white disabled:opacity-60">
              {saving ? 'Creating…' : 'Create order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
