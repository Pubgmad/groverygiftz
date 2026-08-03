'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import ImageUploader from '@/components/admin/ImageUploader';
import { FiPlus, FiX, FiVideo, FiUpload, FiImage } from 'react-icons/fi';

export default function AdminProductForm({ params }) {
  const isEdit = params?.id && params.id !== 'new';
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [collections, setCollections] = useState([]);
  const [form, setForm] = useState({
    title: '', description: '', images: [], productVideo: { url: '', name: '', poster: '' }, customizationPreview: { enabled: false, title: 'Preview your personalized gift', frameImage: '', aspectRatio: '1:1', shape: 'rectangle', instructions: '', requiredImageCount: 0, maxImageCount: 0 }, regularPrice: '', salePrice: '', offerStartsAt: '', offerEndsAt: '',
    stock: 100, collections: [], variants: [], customFields: [],
    giftWrap: { enabled: false, price: 0 }, giftMessage: false,
    isQuoteOnly: false, isFeatured: false, isActive: true,
    seoTitle: '', seoDescription: '',
  });

  useEffect(() => {
    fetch('/api/collections').then(r => r.json()).then(d => setCollections(d.collections || []));
    if (isEdit) {
      fetch(`/api/products/${params.id}`).then(r => r.json()).then(d => {
        setForm({
          title: d.title || '', description: d.description || '', images: d.images || [],
          productVideo: d.productVideo || { url: '', name: '', poster: '' },
          customizationPreview: d.customizationPreview || { enabled: false, title: 'Preview your personalized gift', frameImage: '', aspectRatio: '1:1', shape: 'rectangle', instructions: '' },
          regularPrice: d.regularPrice || '', salePrice: d.salePrice || '',
          offerStartsAt: d.offerStartsAt ? new Date(d.offerStartsAt).toISOString().slice(0, 16) : '',
          offerEndsAt: d.offerEndsAt ? new Date(d.offerEndsAt).toISOString().slice(0, 16) : '',
          stock: d.stock ?? 100, collections: d.collections?.map(c => c._id || c) || [],
          variants: d.variants || [], customFields: d.customFields || [],
          giftWrap: d.giftWrap || { enabled: false, price: 0 }, giftMessage: d.giftMessage || false,
          isQuoteOnly: d.isQuoteOnly || false, isFeatured: d.isFeatured || false,
          isActive: d.isActive ?? true, seoTitle: d.seoTitle || d.metaTitle || '', seoDescription: d.seoDescription || d.metaDescription || '',
        });
      });
    }
  }, [isEdit, params?.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const url = isEdit ? `/api/products/${params.id}` : '/api/products';
    const method = isEdit ? 'PUT' : 'POST';
    const payload = { ...form, offerStartsAt: form.offerStartsAt || null, offerEndsAt: form.offerEndsAt || null };
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    setLoading(false);
    if (res.ok) {
      toast.success(isEdit ? 'Product updated!' : 'Product created!');
      router.push('/account/manage/products');
    } else {
      toast.error('Failed to save product');
    }
  };

  const addVariant = () => setForm(p => ({ ...p, variants: [...p.variants, { name: '', type: 'size', options: [{ label: '', priceAdjustment: 0, inStock: true }] }] }));
  const removeVariant = (idx) => setForm(p => ({ ...p, variants: p.variants.filter((_, i) => i !== idx) }));
  const addVariantOption = (vIdx) => {
    const variants = [...form.variants];
    variants[vIdx].options.push({ label: '', priceAdjustment: 0, inStock: true });
    setForm(p => ({ ...p, variants }));
  };

  const uploadProductVideo = async (file) => {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    const toastId = toast.loading('Uploading product video...');
    try {
      const res = await fetch('/api/upload/video', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Video upload failed');
      setForm(p => ({ ...p, productVideo: { ...p.productVideo, url: data.url, name: data.name || file.name } }));
      toast.success('Product video uploaded', { id: toastId });
    } catch (error) {
      toast.error(error.message || 'Video upload failed', { id: toastId });
    }
  };

  const addCustomField = () => setForm(p => ({ ...p, customFields: [...p.customFields, { label: '', type: 'text', required: false }] }));
  const removeCustomField = (idx) => setForm(p => ({ ...p, customFields: p.customFields.filter((_, i) => i !== idx) }));

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{isEdit ? 'Edit Product' : 'New Product'}</h1>
      <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
        {/* Basic Info */}
        <div className="bg-white p-4 sm:p-6 rounded-xl border space-y-4">
          <h2 className="font-bold text-lg">Basic Information</h2>
          <div>
            <label className="block text-sm font-medium mb-1">Title *</label>
            <input required value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:border-primary-500" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:border-primary-500" rows={6} />
          </div>
        </div>

        {/* Images */}
        <div className="bg-white p-4 sm:p-6 rounded-xl border">
          <h2 className="font-bold text-lg mb-4">Images</h2>
          <ImageUploader images={form.images} onChange={images => setForm(p => ({ ...p, images }))} />
        </div>

        {/* Product Video */}
        <div className="bg-white p-4 sm:p-6 rounded-xl border space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-lg flex items-center gap-2"><FiVideo className="text-primary-600" /> Product Video</h2>
              <p className="text-sm text-gray-500 mt-1">Admin can upload one product video. Maximum size: 100 MB. Customers will see it in the product gallery.</p>
            </div>
            {form.productVideo?.url && <button type="button" onClick={() => setForm(p => ({ ...p, productVideo: { url: '', name: '', poster: '' } }))} className="text-sm text-red-500">Remove</button>}
          </div>
          {form.productVideo?.url ? (
            <div className="rounded-xl border bg-gray-50 p-3">
              <video src={form.productVideo.url} controls className="w-full max-h-80 rounded-lg bg-black" />
              <p className="text-xs text-gray-500 mt-2 truncate">{form.productVideo.name || form.productVideo.url}</p>
            </div>
          ) : (
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary-200 bg-primary-50/40 px-4 py-8 text-center hover:bg-primary-50">
              <FiUpload size={24} className="text-primary-600" />
              <span className="text-sm font-semibold text-gray-800">Upload product video</span>
              <span className="text-xs text-gray-500">MP4, WEBM or MOV up to 100 MB</span>
              <input type="file" accept="video/mp4,video/webm,video/quicktime" className="sr-only" onChange={e => uploadProductVideo(e.target.files?.[0])} />
            </label>
          )}
        </div>

        {/* Customization Preview */}
        <div className="bg-white p-4 sm:p-6 rounded-xl border space-y-4">
          <div>
            <h2 className="font-bold text-lg flex items-center gap-2"><FiImage className="text-primary-600" /> Customization Preview</h2>
            <p className="text-sm text-gray-500 mt-1">Use this for photo frames, lamps, name boards and other customized gifts. The customer can crop, zoom and filter their uploaded image before ordering.</p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
            <input type="checkbox" checked={form.customizationPreview?.enabled || false} onChange={e => setForm(p => ({ ...p, customizationPreview: { ...p.customizationPreview, enabled: e.target.checked } }))} />
            Enable preview editor for this product
          </label>
          <div className="grid md:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium mb-1">Preview Title</label><input value={form.customizationPreview?.title || ''} onChange={e => setForm(p => ({ ...p, customizationPreview: { ...p.customizationPreview, title: e.target.value } }))} className="w-full border rounded-lg px-4 py-2" placeholder="Preview your personalized gift" /></div>
            <div><label className="block text-sm font-medium mb-1">Preview Shape</label><select value={form.customizationPreview?.shape || 'rectangle'} onChange={e => setForm(p => ({ ...p, customizationPreview: { ...p.customizationPreview, shape: e.target.value } }))} className="w-full border rounded-lg px-4 py-2"><option value="rectangle">Rectangle</option><option value="rounded">Rounded Frame</option><option value="circle">Circle</option></select></div>
            <div><label className="block text-sm font-medium mb-1">Photo Area Ratio</label><select value={form.customizationPreview?.aspectRatio || '1:1'} onChange={e => setForm(p => ({ ...p, customizationPreview: { ...p.customizationPreview, aspectRatio: e.target.value } }))} className="w-full border rounded-lg px-4 py-2"><option value="1:1">Square 1:1</option><option value="4:5">Portrait 4:5</option><option value="3:4">Portrait 3:4</option><option value="16:9">Landscape 16:9</option></select></div>
            <div><label className="block text-sm font-medium mb-1">Required Customer Photos</label><input type="number" min="0" value={form.customizationPreview?.requiredImageCount ?? 0} onChange={e => setForm(p => ({ ...p, customizationPreview: { ...p.customizationPreview, requiredImageCount: Math.max(0, Number(e.target.value || 0)) } }))} className="w-full border rounded-lg px-4 py-2" placeholder="Required count" /><p className="text-xs text-gray-500 mt-1">Set the exact number of photos needed for this product.</p></div>
            <div><label className="block text-sm font-medium mb-1">Maximum Customer Photos</label><input type="number" min="0" value={form.customizationPreview?.maxImageCount ?? 0} onChange={e => setForm(p => ({ ...p, customizationPreview: { ...p.customizationPreview, maxImageCount: Math.max(0, Number(e.target.value || 0)) } }))} className="w-full border rounded-lg px-4 py-2" placeholder="Leave 0 to match required" /><p className="text-xs text-gray-500 mt-1">Customer cannot upload more than this count.</p></div>
            <div><label className="block text-sm font-medium mb-1">Frame / Mockup Image</label><ImageUploader images={form.customizationPreview?.frameImage ? [form.customizationPreview.frameImage] : []} onChange={imgs => setForm(p => ({ ...p, customizationPreview: { ...p.customizationPreview, frameImage: imgs[0] || '' } }))} /></div>
          </div>
          <div><label className="block text-sm font-medium mb-1">Customer Instructions</label><textarea value={form.customizationPreview?.instructions || ''} onChange={e => setForm(p => ({ ...p, customizationPreview: { ...p.customizationPreview, instructions: e.target.value } }))} className="w-full border rounded-lg px-4 py-2" rows={2} placeholder="Upload a clear front-facing photo. Keep faces inside the safe area." /></div>
        </div>

        {/* Pricing */}
        <div className="bg-white p-4 sm:p-6 rounded-xl border space-y-4">
          <h2 className="font-bold text-lg">Pricing & Inventory</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Regular Price *</label>
              <input type="number" required value={form.regularPrice} onChange={e => setForm(p => ({ ...p, regularPrice: e.target.value }))}
                className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:border-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Sale Price</label>
              <input type="number" value={form.salePrice} onChange={e => setForm(p => ({ ...p, salePrice: e.target.value }))}
                className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:border-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Stock</label>
              <input type="number" value={form.stock} onChange={e => setForm(p => ({ ...p, stock: e.target.value }))}
                className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:border-primary-500" />
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Offer Starts At</label>
              <input type="datetime-local" value={form.offerStartsAt} onChange={e => setForm(p => ({ ...p, offerStartsAt: e.target.value }))}
                className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:border-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Offer Ends At</label>
              <input type="datetime-local" value={form.offerEndsAt} onChange={e => setForm(p => ({ ...p, offerEndsAt: e.target.value }))}
                className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:border-primary-500" />
            </div>
          </div>
        </div>

        {/* Collections */}
        <div className="bg-white p-4 sm:p-6 rounded-xl border">
          <h2 className="font-bold text-lg mb-4">Collections</h2>
          <div className="flex flex-wrap gap-2">
            {collections.map(col => (
              <label key={col._id} className="flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input type="checkbox" checked={form.collections.includes(col._id)}
                  onChange={e => {
                    setForm(p => ({
                      ...p,
                      collections: e.target.checked ? [...p.collections, col._id] : p.collections.filter(id => id !== col._id),
                    }));
                  }} />
                <span className="text-sm">{col.name}</span>
              </label>
            ))}
            {collections.length === 0 && <p className="text-gray-500 text-sm">No collections. Create one first.</p>}
          </div>
        </div>

        {/* Variants */}
        <div className="bg-white p-4 sm:p-6 rounded-xl border">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold text-lg">Variants</h2>
            <button type="button" onClick={addVariant} className="text-sm text-primary-600 flex items-center gap-1"><FiPlus /> Add Variant</button>
          </div>
          {form.variants.map((variant, vIdx) => (
            <div key={vIdx} className="border rounded-lg p-3 sm:p-4 mb-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:gap-4 mb-3">
                <input placeholder="Variant name (e.g. Size)" value={variant.name}
                  onChange={e => { const v = [...form.variants]; v[vIdx].name = e.target.value; setForm(p => ({ ...p, variants: v })); }}
                  className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-500" />
                <select value={variant.type} onChange={e => { const v = [...form.variants]; v[vIdx].type = e.target.value; setForm(p => ({ ...p, variants: v })); }}
                  className="border rounded-lg px-3 py-2 text-sm">
                  <option value="size">Size</option><option value="color">Color</option><option value="quantity">Quantity</option>
                </select>
                <button type="button" onClick={() => removeVariant(vIdx)} className="text-red-500"><FiX /></button>
              </div>
              {variant.options?.map((opt, oIdx) => (
                <div key={oIdx} className="grid grid-cols-1 gap-2 mb-2 sm:ml-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center">
                  <input placeholder="Option label" value={opt.label}
                    onChange={e => { const v = [...form.variants]; v[vIdx].options[oIdx].label = e.target.value; setForm(p => ({ ...p, variants: v })); }}
                    className="flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-primary-500" />
                  <input type="number" placeholder="Extra price" value={opt.priceAdjustment ?? opt.price ?? 0}
                    onChange={e => { const v = [...form.variants]; v[vIdx].options[oIdx].priceAdjustment = e.target.value; setForm(p => ({ ...p, variants: v })); }}
                    className="w-full sm:w-24 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-primary-500" />
                  <label className="flex items-center gap-1 text-xs text-gray-600">
                    <input type="checkbox" checked={opt.inStock !== false}
                      onChange={e => { const v = [...form.variants]; v[vIdx].options[oIdx].inStock = e.target.checked; setForm(p => ({ ...p, variants: v })); }} />
                    In stock
                  </label>
                  <button type="button" onClick={() => { const v = [...form.variants]; v[vIdx].options.splice(oIdx, 1); setForm(p => ({ ...p, variants: v })); }}
                    className="text-red-400"><FiX size={14} /></button>
                </div>
              ))}
              <button type="button" onClick={() => addVariantOption(vIdx)} className="text-xs text-primary-600 ml-4">+ Add Option</button>
            </div>
          ))}
        </div>

        {/* Custom Fields */}
        <div className="bg-white p-4 sm:p-6 rounded-xl border">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold text-lg">Custom Fields</h2>
            <button type="button" onClick={addCustomField} className="text-sm text-primary-600 flex items-center gap-1"><FiPlus /> Add Field</button>
          </div>
          {form.customFields.map((field, fIdx) => (
            <div key={fIdx} className="grid grid-cols-1 gap-3 mb-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center">
              <input placeholder="Field label" value={field.label}
                onChange={e => { const f = [...form.customFields]; f[fIdx].label = e.target.value; setForm(p => ({ ...p, customFields: f })); }}
                className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-500" />
              <select value={field.type} onChange={e => { const f = [...form.customFields]; f[fIdx].type = e.target.value; setForm(p => ({ ...p, customFields: f })); }}
                className="border rounded-lg px-3 py-2 text-sm">
                <option value="text">Text</option><option value="textarea">Textarea</option><option value="file">File Upload</option>
              </select>
              <label className="flex items-center gap-1 text-sm">
                <input type="checkbox" checked={field.required}
                  onChange={e => { const f = [...form.customFields]; f[fIdx].required = e.target.checked; setForm(p => ({ ...p, customFields: f })); }} />
                Req
              </label>
              <button type="button" onClick={() => removeCustomField(fIdx)} className="text-red-500"><FiX /></button>
            </div>
          ))}
        </div>

        {/* Options */}
        <div className="bg-white p-4 sm:p-6 rounded-xl border space-y-4">
          <h2 className="font-bold text-lg">Options</h2>
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.giftWrap.enabled}
                onChange={e => setForm(p => ({ ...p, giftWrap: { ...p.giftWrap, enabled: e.target.checked } }))} />
              <span className="text-sm">Gift Wrap</span>
            </label>
            {form.giftWrap.enabled && (
              <input type="number" placeholder="Wrap price" value={form.giftWrap.price}
                onChange={e => setForm(p => ({ ...p, giftWrap: { ...p.giftWrap, price: e.target.value } }))}
                className="w-24 border rounded-lg px-3 py-1.5 text-sm" />
            )}
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.giftMessage}
                onChange={e => setForm(p => ({ ...p, giftMessage: e.target.checked }))} />
              <span className="text-sm">Gift Message</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.isQuoteOnly}
                onChange={e => setForm(p => ({ ...p, isQuoteOnly: e.target.checked }))} />
              <span className="text-sm">Quote Only (Contact for Price)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.isFeatured}
                onChange={e => setForm(p => ({ ...p, isFeatured: e.target.checked }))} />
              <span className="text-sm">Featured</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.isActive}
                onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))} />
              <span className="text-sm">Active</span>
            </label>
          </div>
        </div>

        {/* SEO */}
        <div className="bg-white p-4 sm:p-6 rounded-xl border space-y-4">
          <h2 className="font-bold text-lg">SEO</h2>
          <input placeholder="Meta Title" value={form.seoTitle} onChange={e => setForm(p => ({ ...p, seoTitle: e.target.value }))}
            className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:border-primary-500" />
          <textarea placeholder="Meta Description" value={form.seoDescription} onChange={e => setForm(p => ({ ...p, seoDescription: e.target.value }))}
            className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:border-primary-500" rows={2} />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="submit" disabled={loading} className="w-full sm:w-auto bg-primary-600 text-white px-6 sm:px-8 py-3 rounded-lg font-semibold hover:bg-primary-700">
            {loading ? 'Saving...' : isEdit ? 'Update Product' : 'Create Product'}
          </button>
          <button type="button" onClick={() => router.push('/account/manage/products')} className="w-full sm:w-auto px-6 sm:px-8 py-3 border rounded-lg hover:bg-gray-50">Cancel</button>
        </div>
      </form>
    </div>
  );
}

