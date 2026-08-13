'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import ImageUploader from '@/components/admin/ImageUploader';
import { FiPlus, FiX, FiVideo, FiUpload, FiImage, FiLoader } from 'react-icons/fi';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand',
  'West Bengal', 'Delhi', 'Jammu & Kashmir', 'Ladakh', 'Puducherry',
];

const defaultPreviewArea = () => ({ label: '', width: '', height: '', unit: 'inch', frameImage: '', shape: 'rectangle', required: true, requiresImageUpload: true, instructions: '' });
const defaultDelivery = () => ({ useCustomDelivery: false, tamilNaduShippingCost: 0, otherStateShippingCost: 120, tamilNaduDeliveryEstimate: 'Within 8 days', otherStateDeliveryEstimate: '10-15 days', stateOverrides: [] });

function normalizePreviewAreas(preview = {}) {
  if (Array.isArray(preview.areas) && preview.areas.length > 0) return preview.areas.map((area) => ({ ...defaultPreviewArea(), ...area }));
  if (!preview.enabled) return [];
  const ratio = String(preview.aspectRatio || '1:1').split(':').map(Number);
  return [{ ...defaultPreviewArea(), label: preview.title || 'Photo 1', width: ratio[0] || 1, height: ratio[1] || 1, frameImage: preview.frameImage || '', shape: preview.shape || 'rectangle', instructions: preview.instructions || '' }];
}
function toDatetimeLocalInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}

function fromDatetimeLocalInput(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export default function AdminProductForm({ params }) {
  const isEdit = params?.id && params.id !== 'new';
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [collections, setCollections] = useState([]);
  const [shippingTemplates, setShippingTemplates] = useState([]);
  const [videoUploading, setVideoUploading] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', images: [], responsiveImages: { desktop: [], tablet: [], mobile: [] }, productVideo: { url: '', name: '', poster: '' }, customizationPreview: { enabled: false, title: 'Preview your personalized gift', frameImage: '', aspectRatio: '1:1', shape: 'rectangle', instructions: '', requiredImageCount: 0, maxImageCount: 0, areas: [] }, delivery: defaultDelivery(), regularPrice: '', salePrice: '', offerStartsAt: '', offerEndsAt: '',
    stock: 100, collections: [], variants: [], customFields: [], collageEnabled: false, collageTemplates: [],
    giftWrap: { enabled: false, price: 0 }, giftMessage: false,
    isQuoteOnly: false, isFeatured: false, isBestSeller: false, isActive: true,
    seoTitle: '', seoDescription: '',
  });

  useEffect(() => {
    fetch('/api/collections').then(r => r.json()).then(d => setCollections(d.collections || []));
    fetch('/api/shipping-templates').then(r => r.json()).then(d => setShippingTemplates(d.templates || [])).catch(() => {});
    if (isEdit) {
      fetch(`/api/products/${params.id}`).then(r => r.json()).then(d => {
        setForm({
          title: d.title || '', description: d.description || '', images: d.images || [], responsiveImages: { desktop: d.responsiveImages?.desktop || d.images || [], tablet: d.responsiveImages?.tablet || [], mobile: d.responsiveImages?.mobile || [] },
          productVideo: d.productVideo || { url: '', name: '', poster: '' },
          customizationPreview: { ...(d.customizationPreview || { enabled: false, title: 'Preview your personalized gift', frameImage: '', aspectRatio: '1:1', shape: 'rectangle', instructions: '' }), areas: normalizePreviewAreas(d.customizationPreview || {}) },
          delivery: { ...defaultDelivery(), ...(d.delivery || {}), stateOverrides: d.delivery?.stateOverrides || [] },
          regularPrice: d.regularPrice || '', salePrice: d.salePrice || '',
          offerStartsAt: toDatetimeLocalInput(d.offerStartsAt),
          offerEndsAt: toDatetimeLocalInput(d.offerEndsAt),
          stock: d.stock ?? 100, collections: d.collections?.map(c => c._id || c) || [],
          variants: d.variants || [], customFields: d.customFields || [], collageEnabled: !!d.collageEnabled, collageTemplates: d.collageTemplates || [],
          giftWrap: d.giftWrap || { enabled: false, price: 0 }, giftMessage: d.giftMessage || false,
          isQuoteOnly: d.isQuoteOnly || false, isFeatured: d.isFeatured || false, isBestSeller: d.isBestSeller || false,
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
    const payload = { ...form, offerStartsAt: fromDatetimeLocalInput(form.offerStartsAt), offerEndsAt: fromDatetimeLocalInput(form.offerEndsAt) };
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    setLoading(false);
    if (res.ok) {
      toast.success(isEdit ? 'Product updated!' : 'Product created!');
      router.push('/account/manage/products');
    } else {
      toast.error('Failed to save product');
    }
  };

  const addVariant = () => setForm(p => ({ ...p, variants: [...p.variants, { name: '', type: 'size', options: [{ label: '', priceAdjustment: 0, useOwnPrice: false, regularPrice: '', salePrice: '', stateOverrides: [], shippingTemplate: '', requiresImageUpload: false, previewWidth: '', previewHeight: '', previewUnit: 'inch', previewFrameImage: '', previewInstructions: '', inStock: true }] }] }));
  const removeVariant = (idx) => setForm(p => ({ ...p, variants: p.variants.filter((_, i) => i !== idx) }));
  const addVariantOption = (vIdx) => {
    const variants = [...form.variants];
    variants[vIdx].options.push({ label: '', priceAdjustment: 0, useOwnPrice: false, regularPrice: '', salePrice: '', stateOverrides: [], shippingTemplate: '', requiresImageUpload: false, previewWidth: '', previewHeight: '', previewUnit: 'inch', previewFrameImage: '', previewInstructions: '', inStock: true });
    setForm(p => ({ ...p, variants }));
  };

  const uploadProductVideo = async (file) => {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    setVideoUploading(true);
    const toastId = toast.loading('Uploading product video...');
    try {
      const res = await fetch('/api/upload/video', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Video upload failed');
      setForm(p => ({ ...p, productVideo: { ...p.productVideo, url: data.url, name: data.name || file.name } }));
      toast.success('Product video uploaded', { id: toastId });
    } catch (error) {
      toast.error(error.message || 'Video upload failed', { id: toastId });
    } finally {
      setVideoUploading(false);
    }
  };

  const addCustomField = () => setForm(p => ({ ...p, customFields: [...p.customFields, { label: '', type: 'text', required: false }] }));
  const removeCustomField = (idx) => setForm(p => ({ ...p, customFields: p.customFields.filter((_, i) => i !== idx) }));
  const addCollageTemplate = () => setForm(p => ({ ...p, collageTemplates: [...(p.collageTemplates || []), { label: '', minImages: 1, maxImages: 1, instructions: '', isActive: true }] }));
  const updateCollageTemplate = (idx, updates) => {
    const collageTemplates = [...(form.collageTemplates || [])];
    collageTemplates[idx] = { ...(collageTemplates[idx] || {}), ...updates };
    setForm(p => ({ ...p, collageTemplates }));
  };
  const removeCollageTemplate = (idx) => setForm(p => ({ ...p, collageTemplates: (p.collageTemplates || []).filter((_, i) => i !== idx) }));

  const updatePreviewArea = (idx, key, value) => {
    const areas = [...(form.customizationPreview?.areas || [])];
    areas[idx] = { ...areas[idx], [key]: value };
    setForm(p => ({ ...p, customizationPreview: { ...p.customizationPreview, areas, requiredImageCount: areas.filter(a => a.required !== false).length, maxImageCount: areas.length } }));
  };
  const addPreviewArea = () => setForm(p => {
    const areas = [...(p.customizationPreview?.areas || []), { ...defaultPreviewArea(), label: `Photo ${((p.customizationPreview?.areas || []).length) + 1}` }];
    return { ...p, customizationPreview: { ...p.customizationPreview, enabled: true, areas, requiredImageCount: areas.filter(a => a.required !== false).length, maxImageCount: areas.length } };
  });
  const removePreviewArea = (idx) => setForm(p => {
    const areas = (p.customizationPreview?.areas || []).filter((_, i) => i !== idx);
    return { ...p, customizationPreview: { ...p.customizationPreview, areas, requiredImageCount: areas.filter(a => a.required !== false).length, maxImageCount: areas.length } };
  });
  const updateStateOverride = (idx, key, value) => {
    const stateOverrides = [...(form.delivery?.stateOverrides || [])];
    stateOverrides[idx] = { ...stateOverrides[idx], [key]: value };
    setForm(p => ({ ...p, delivery: { ...p.delivery, stateOverrides } }));
  };
  const addStateOverride = () => setForm(p => ({ ...p, delivery: { ...p.delivery, stateOverrides: [...(p.delivery?.stateOverrides || []), { state: '', shippingCost: 0, deliveryEstimate: '' }] } }));
  const removeStateOverride = (idx) => setForm(p => ({ ...p, delivery: { ...p.delivery, stateOverrides: (p.delivery?.stateOverrides || []).filter((_, i) => i !== idx) } }));
  const updateVariantOption = (vIdx, oIdx, updates) => {
    const variants = [...form.variants];
    variants[vIdx].options[oIdx] = { ...(variants[vIdx].options[oIdx] || {}), ...updates };
    setForm(p => ({ ...p, variants }));
  };
  const updateVariantStateOverride = (vIdx, oIdx, rowIdx, key, value) => {
    const variants = [...form.variants];
    const option = { ...(variants[vIdx].options[oIdx] || {}) };
    const stateOverrides = [...(option.stateOverrides || [])];
    stateOverrides[rowIdx] = { ...stateOverrides[rowIdx], [key]: value };
    option.stateOverrides = stateOverrides;
    variants[vIdx].options[oIdx] = option;
    setForm(p => ({ ...p, variants }));
  };
  const templateRatesToOverrides = (templateId) => {
    const template = shippingTemplates.find((entry) => entry._id === templateId);
    return (template?.rates || []).map((row) => ({ state: row.state, shippingCost: Number(row.shippingCost || 0), deliveryEstimate: row.deliveryEstimate || '' }));
  };
  const applyProductShippingTemplate = (templateId) => setForm(p => ({ ...p, delivery: { ...defaultDelivery(), ...p.delivery, useCustomDelivery: true, shippingTemplate: templateId, stateOverrides: templateRatesToOverrides(templateId) } }));
  const applyVariantShippingTemplate = (vIdx, oIdx, templateId) => {
    const overrides = templateRatesToOverrides(templateId);
    updateVariantOption(vIdx, oIdx, { shippingTemplate: templateId, stateOverrides: overrides });
  };
  const addVariantStateOverride = (vIdx, oIdx) => {
    const variants = [...form.variants];
    const option = { ...(variants[vIdx].options[oIdx] || {}) };
    option.stateOverrides = [...(option.stateOverrides || []), { state: '', shippingCost: 0, deliveryEstimate: '' }];
    variants[vIdx].options[oIdx] = option;
    setForm(p => ({ ...p, variants }));
  };
  const removeVariantStateOverride = (vIdx, oIdx, rowIdx) => {
    const variants = [...form.variants];
    const option = { ...(variants[vIdx].options[oIdx] || {}) };
    option.stateOverrides = (option.stateOverrides || []).filter((_, i) => i !== rowIdx);
    variants[vIdx].options[oIdx] = option;
    setForm(p => ({ ...p, variants }));
  };

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
        <div className="bg-white p-4 sm:p-6 rounded-xl border space-y-4">
          <div>
            <h2 className="font-bold text-lg">Product Images</h2>
            <p className="mt-1 text-sm text-gray-500">Upload device-specific product images so banners/gallery previews fit correctly on every screen.</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border bg-primary-50/40 p-3"><p className="text-sm font-semibold">Desktop Images</p><p className="mb-2 text-xs text-gray-500">Recommended: 5 x 4 inches landscape/square</p><ImageUploader images={form.responsiveImages?.desktop?.length ? form.responsiveImages.desktop : form.images} onChange={images => setForm(p => ({ ...p, images, responsiveImages: { ...(p.responsiveImages || {}), desktop: images } }))} /></div>
            <div className="rounded-xl border bg-primary-50/40 p-3"><p className="text-sm font-semibold">Tablet Images</p><p className="mb-2 text-xs text-gray-500">Recommended: 4 x 4 inches square</p><ImageUploader images={form.responsiveImages?.tablet || []} onChange={images => setForm(p => ({ ...p, responsiveImages: { ...(p.responsiveImages || {}), tablet: images } }))} /></div>
            <div className="rounded-xl border bg-primary-50/40 p-3"><p className="text-sm font-semibold">Mobile Images</p><p className="mb-2 text-xs text-gray-500">Recommended: 3 x 4 inches portrait</p><ImageUploader images={form.responsiveImages?.mobile || []} onChange={images => setForm(p => ({ ...p, responsiveImages: { ...(p.responsiveImages || {}), mobile: images } }))} /></div>
          </div>
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
            <label className={`relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary-200 bg-primary-50/40 px-4 py-8 text-center hover:bg-primary-50 ${videoUploading ? 'pointer-events-none opacity-80' : ''}`}>
              {videoUploading ? <FiLoader size={28} className="animate-spin text-primary-600" /> : <FiUpload size={24} className="text-primary-600" />}
              <span className="text-sm font-semibold text-gray-800">{videoUploading ? 'Uploading video...' : 'Upload product video'}</span>
              <span className="text-xs text-gray-500">MP4, WEBM or MOV up to 100 MB</span>
              <input type="file" accept="video/mp4,video/webm,video/quicktime" className="sr-only" disabled={videoUploading} onChange={e => uploadProductVideo(e.target.files?.[0])} />
            </label>
          )}
        </div>

        {/* Customization Preview */}
        <div className="bg-white p-4 sm:p-6 rounded-xl border space-y-4">
          <div>
            <h2 className="font-bold text-lg flex items-center gap-2"><FiImage className="text-primary-600" /> Customization Preview</h2>
            <p className="text-sm text-gray-500 mt-1">Use this for personalized products. Add one photo area for each frame/place where the customer photo must fit.</p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
            <input type="checkbox" checked={form.customizationPreview?.enabled || false} onChange={e => setForm(p => {
              const enabled = e.target.checked;
              const currentAreas = p.customizationPreview?.areas || [];
              const areas = enabled && currentAreas.length === 0 ? [{ ...defaultPreviewArea(), label: 'Photo 1' }] : currentAreas;
              return { ...p, customizationPreview: { ...p.customizationPreview, enabled, areas, requiredImageCount: areas.filter(a => a.required !== false).length, maxImageCount: areas.length } };
            })} />
            Enable preview editor for this product
          </label>
          <div className="grid md:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium mb-1">Preview Section Title</label><input value={form.customizationPreview?.title || ''} onChange={e => setForm(p => ({ ...p, customizationPreview: { ...p.customizationPreview, title: e.target.value } }))} className="w-full border rounded-lg px-4 py-2" placeholder="Preview your personalized gift" /></div>
            <div><label className="block text-sm font-medium mb-1">General Instructions</label><input value={form.customizationPreview?.instructions || ''} onChange={e => setForm(p => ({ ...p, customizationPreview: { ...p.customizationPreview, instructions: e.target.value } }))} className="w-full border rounded-lg px-4 py-2" placeholder="Upload clear photos. Keep faces inside the safe area." /></div>
          </div>
          <div className="rounded-xl border border-primary-100 bg-primary-50/40 p-4 space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-gray-900">Photo Areas</p>
                <p className="text-xs text-gray-500">For a combo product, add each frame/photo slot separately with its exact width and height.</p>
              </div>
              <button type="button" onClick={addPreviewArea} className="inline-flex w-full items-center justify-center gap-1 rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white sm:w-auto"><FiPlus /> Add Photo Area</button>
            </div>
            {(form.customizationPreview?.areas || []).map((area, idx) => (
              <div key={idx} className="rounded-xl border bg-white p-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-sm text-gray-800">Area {idx + 1}</p>
                  <button type="button" onClick={() => removePreviewArea(idx)} className="text-red-500"><FiX /></button>
                </div>
                <div className="grid md:grid-cols-4 gap-3">
                  <div><label className="block text-xs font-medium mb-1">Label</label><input value={area.label || ''} onChange={e => updatePreviewArea(idx, 'label', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder={`Photo ${idx + 1}`} /></div>
                  <div><label className="block text-xs font-medium mb-1">Width</label><input type="number" min="0" step="0.01" value={area.width ?? ''} onChange={e => updatePreviewArea(idx, 'width', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="8" /></div>
                  <div><label className="block text-xs font-medium mb-1">Height</label><input type="number" min="0" step="0.01" value={area.height ?? ''} onChange={e => updatePreviewArea(idx, 'height', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="10" /></div>
                  <div><label className="block text-xs font-medium mb-1">Unit</label><select value={area.unit || 'inch'} onChange={e => updatePreviewArea(idx, 'unit', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm"><option value="inch">Inch</option><option value="cm">CM</option><option value="mm">MM</option></select></div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2"><label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={area.required !== false} onChange={e => updatePreviewArea(idx, 'required', e.target.checked)} /> Photo required for this area</label><label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={area.requiresImageUpload !== false} onChange={e => updatePreviewArea(idx, 'requiresImageUpload', e.target.checked)} /> Enable upload and preview for this label</label></div>
                <div><label className="block text-xs font-medium mb-1">Area Instructions</label><input value={area.instructions || ''} onChange={e => updatePreviewArea(idx, 'instructions', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Example: close-up portrait, landscape photo, family photo" /></div>
              </div>
            ))}
            {(form.customizationPreview?.areas || []).length === 0 && <p className="rounded-lg bg-white px-4 py-3 text-sm text-gray-500">No photo areas added yet.</p>}
          </div>
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

        {/* Product Delivery Pricing */}
        <div className="bg-white p-4 sm:p-6 rounded-xl border space-y-4">
          <h2 className="font-bold text-lg">Product Delivery Pricing</h2>
          <p className="text-sm text-gray-500">Use store default shipping, or set delivery charges for this specific product. If a state override exists, checkout uses that state price first.</p>
          <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
            <input type="checkbox" checked={form.delivery?.useCustomDelivery || false} onChange={e => setForm(p => ({ ...p, delivery: { ...defaultDelivery(), ...p.delivery, useCustomDelivery: e.target.checked } }))} />
            Use custom delivery pricing for this product
          </label>
          {form.delivery?.useCustomDelivery && (
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-1">Tamil Nadu Delivery Charge (INR)</label><input type="number" min="0" value={form.delivery?.tamilNaduShippingCost ?? ''} onChange={e => setForm(p => ({ ...p, delivery: { ...p.delivery, tamilNaduShippingCost: e.target.value } }))} className="w-full border rounded-lg px-4 py-2" /></div>
                <div><label className="block text-sm font-medium mb-1">Other States Default Charge (INR)</label><input type="number" min="0" value={form.delivery?.otherStateShippingCost ?? ''} onChange={e => setForm(p => ({ ...p, delivery: { ...p.delivery, otherStateShippingCost: e.target.value } }))} className="w-full border rounded-lg px-4 py-2" /></div>
                <div><label className="block text-sm font-medium mb-1">Tamil Nadu Delivery Estimate</label><input value={form.delivery?.tamilNaduDeliveryEstimate || ''} onChange={e => setForm(p => ({ ...p, delivery: { ...p.delivery, tamilNaduDeliveryEstimate: e.target.value } }))} className="w-full border rounded-lg px-4 py-2" placeholder="Within 8 days" /></div>
                <div><label className="block text-sm font-medium mb-1">Other States Default Estimate</label><input value={form.delivery?.otherStateDeliveryEstimate || ''} onChange={e => setForm(p => ({ ...p, delivery: { ...p.delivery, otherStateDeliveryEstimate: e.target.value } }))} className="w-full border rounded-lg px-4 py-2" placeholder="10-15 days" /></div>
              </div>
              <div className="rounded-xl border bg-gray-50 p-4 space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div><p className="font-semibold text-sm text-gray-900">State-wise Overrides</p><p className="text-xs text-gray-500">Optional. Add only states that need a different charge or delivery estimate.</p></div>
                  <button type="button" onClick={addStateOverride} className="inline-flex w-full items-center justify-center gap-1 rounded-lg border bg-white px-3 py-2 text-sm font-semibold text-primary-600 sm:w-auto"><FiPlus /> Add State</button>
                </div>
                {(form.delivery?.stateOverrides || []).map((row, idx) => (
                  <div key={idx} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_120px_1fr_auto] sm:items-center">
                    <select value={row.state || ''} onChange={e => updateStateOverride(idx, 'state', e.target.value)} className="border rounded-lg px-3 py-2 text-sm"><option value="">Select state</option>{INDIAN_STATES.map(state => <option key={state} value={state}>{state}</option>)}</select>
                    <input type="number" min="0" value={row.shippingCost ?? ''} onChange={e => updateStateOverride(idx, 'shippingCost', e.target.value)} className="border rounded-lg px-3 py-2 text-sm" placeholder="Cost" />
                    <input value={row.deliveryEstimate || ''} onChange={e => updateStateOverride(idx, 'deliveryEstimate', e.target.value)} className="border rounded-lg px-3 py-2 text-sm" placeholder="Estimate" />
                    <button type="button" onClick={() => removeStateOverride(idx)} className="text-red-500"><FiX /></button>
                  </div>
                ))}
              </div>
            </div>
          )}
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
            <div><h2 className="font-bold text-lg">Variants</h2><p className="text-xs text-gray-500 mt-1">Variants let customers choose options like size, color, or quantity. Use extra price for add-ons, or switch on own pricing when each option has its own regular/sale price.</p></div>
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
                <div key={oIdx} className="mb-3 rounded-xl border bg-gray-50 p-3 sm:ml-4">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                    <input placeholder="Option label" value={opt.label}
                      onChange={e => updateVariantOption(vIdx, oIdx, { label: e.target.value })}
                      className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-500 bg-white" />
                    <label className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-xs font-semibold text-gray-700">
                      <input type="checkbox" checked={!!opt.useOwnPrice}
                        onChange={e => updateVariantOption(vIdx, oIdx, { useOwnPrice: e.target.checked })} />
                      Own regular/sale price
                    </label>
                    <button type="button" onClick={() => { const v = [...form.variants]; v[vIdx].options.splice(oIdx, 1); setForm(p => ({ ...p, variants: v })); }}
                      className="justify-self-start text-red-500 sm:justify-self-end"><FiX size={16} /></button>
                  </div>
                  {opt.useOwnPrice ? (
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div><label className="block text-xs font-medium text-gray-600 mb-1">Variant Regular Price</label><input type="number" placeholder="Regular price" value={opt.regularPrice ?? ''}
                        onChange={e => updateVariantOption(vIdx, oIdx, { regularPrice: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-500 bg-white" /></div>
                      <div><label className="block text-xs font-medium text-gray-600 mb-1">Variant Sale Price</label><input type="number" placeholder="Sale price optional" value={opt.salePrice ?? ''}
                        onChange={e => updateVariantOption(vIdx, oIdx, { salePrice: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-500 bg-white" /></div>
                    </div>
                  ) : (
                    <div className="mt-3"><label className="block text-xs font-medium text-gray-600 mb-1">Extra Price Added To Product</label><input type="number" placeholder="Extra price" value={opt.priceAdjustment ?? opt.price ?? ''}
                      onChange={e => updateVariantOption(vIdx, oIdx, { priceAdjustment: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-500 bg-white sm:w-40" /></div>
                  )}
                  <label className="mt-3 flex items-center gap-2 text-xs text-gray-600">
                    <input type="checkbox" checked={opt.inStock !== false}
                      onChange={e => updateVariantOption(vIdx, oIdx, { inStock: e.target.checked })} />
                    In stock
                  </label>
                  <label className="mt-2 flex items-center gap-2 text-xs text-gray-600">
                    <input type="checkbox" checked={!!opt.requiresImageUpload}
                      onChange={e => updateVariantOption(vIdx, oIdx, { requiresImageUpload: e.target.checked })} />
                    Require customer image upload and preview for this option label
                  </label>
                  {opt.requiresImageUpload && (
                    <div className="mt-3 rounded-lg border border-primary-100 bg-white p-3">
                      <p className="text-xs font-bold text-gray-800">Variant Preview Size</p>
                      <p className="mt-1 text-[11px] text-gray-500">Set the exact frame size customers should see for this option. This works like the normal product preview.</p>
                      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_100px]">
                        <input type="number" min="0" placeholder="Width" value={opt.previewWidth ?? ''}
                          onChange={e => updateVariantOption(vIdx, oIdx, { previewWidth: e.target.value })}
                          className="border rounded-lg px-3 py-2 text-xs" />
                        <input type="number" min="0" placeholder="Height" value={opt.previewHeight ?? ''}
                          onChange={e => updateVariantOption(vIdx, oIdx, { previewHeight: e.target.value })}
                          className="border rounded-lg px-3 py-2 text-xs" />
                        <select value={opt.previewUnit || 'inch'} onChange={e => updateVariantOption(vIdx, oIdx, { previewUnit: e.target.value })} className="border rounded-lg px-3 py-2 text-xs">
                          <option value="inch">inch</option><option value="cm">cm</option><option value="px">px</option>
                        </select>
                      </div>
                      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[220px_1fr]">
                        <ImageUploader value={opt.previewFrameImage || ''} onChange={(url) => updateVariantOption(vIdx, oIdx, { previewFrameImage: url })} label="Frame overlay image" />
                        <textarea rows={3} value={opt.previewInstructions || ''} onChange={e => updateVariantOption(vIdx, oIdx, { previewInstructions: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-xs" placeholder="Instructions for this variant preview" />
                      </div>
                    </div>
                  )}
                  <div className="mt-3 rounded-lg border bg-white p-3 space-y-2">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div><p className="text-xs font-bold text-gray-800">Variant State Delivery Charges</p><p className="text-[11px] text-gray-500">Optional. These override product delivery charges only when this option is selected.</p></div>
                      {shippingTemplates.length > 0 && <select value={opt.shippingTemplate || ''} onChange={e => applyVariantShippingTemplate(vIdx, oIdx, e.target.value)} className="rounded-lg border px-2.5 py-1.5 text-xs"><option value="">Apply template</option>{shippingTemplates.map(template => <option key={template._id} value={template._id}>{template.name}</option>)}</select>}
                      <button type="button" onClick={() => addVariantStateOverride(vIdx, oIdx)} className="inline-flex w-full items-center justify-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold text-primary-600 sm:w-auto"><FiPlus /> Add State</button>
                    </div>
                    {(opt.stateOverrides || []).map((row, rowIdx) => (
                      <div key={rowIdx} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_110px_1fr_auto] sm:items-center">
                        <select value={row.state || ''} onChange={e => updateVariantStateOverride(vIdx, oIdx, rowIdx, 'state', e.target.value)} className="border rounded-lg px-3 py-2 text-xs"><option value="">Select state</option>{INDIAN_STATES.map(state => <option key={state} value={state}>{state}</option>)}</select>
                        <input type="number" min="0" value={row.shippingCost ?? ''} onChange={e => updateVariantStateOverride(vIdx, oIdx, rowIdx, 'shippingCost', e.target.value)} className="border rounded-lg px-3 py-2 text-xs" placeholder="Cost" />
                        <input value={row.deliveryEstimate || ''} onChange={e => updateVariantStateOverride(vIdx, oIdx, rowIdx, 'deliveryEstimate', e.target.value)} className="border rounded-lg px-3 py-2 text-xs" placeholder="Estimate" />
                        <button type="button" onClick={() => removeVariantStateOverride(vIdx, oIdx, rowIdx)} className="text-red-500"><FiX size={14} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <button type="button" onClick={() => addVariantOption(vIdx)} className="text-xs text-primary-600 ml-4">+ Add Option</button>
            </div>
          ))}
        </div>

        {/* Collage Upload Templates */}
        <div className="bg-white p-4 sm:p-6 rounded-xl border space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-bold text-lg">Collage Upload Templates</h2>
              <p className="text-xs text-gray-500 mt-1">Switch this on only for collage products. Each label creates a separate customer upload section with its own minimum and maximum image count.</p>
            </div>
            <button type="button" onClick={addCollageTemplate} disabled={!form.collageEnabled} className="inline-flex w-full items-center justify-center gap-1 rounded-lg border px-3 py-2 text-sm font-semibold text-primary-600 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"><FiPlus /> Add Collage Label</button>
          </div>
          <label className="flex items-center gap-2 rounded-xl border bg-primary-50/50 px-4 py-3 text-sm font-semibold text-gray-800">
            <input type="checkbox" checked={!!form.collageEnabled} onChange={e => setForm(p => ({ ...p, collageEnabled: e.target.checked }))} />
            Enable collage uploads for this product
          </label>
          {form.collageEnabled && (form.collageTemplates || []).map((template, idx) => (
            <div key={idx} className="rounded-xl border bg-gray-50 p-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-gray-900">Collage Label {idx + 1}</p>
                <button type="button" onClick={() => removeCollageTemplate(idx)} className="text-red-500"><FiX /></button>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div><label className="block text-xs font-medium mb-1">Label</label><input value={template.label || ''} onChange={e => updateCollageTemplate(idx, { label: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm bg-white" placeholder="Example: 20 Photos" /></div>
                <div><label className="block text-xs font-medium mb-1">Minimum Images</label><input type="number" min="1" value={template.minImages ?? ''} onChange={e => updateCollageTemplate(idx, { minImages: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm bg-white" /></div>
                <div><label className="block text-xs font-medium mb-1">Maximum Images</label><input type="number" min="1" value={template.maxImages ?? ''} onChange={e => updateCollageTemplate(idx, { maxImages: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm bg-white" /></div>
              </div>
              <div><label className="block text-xs font-medium mb-1">Customer Instructions</label><input value={template.instructions || ''} onChange={e => updateCollageTemplate(idx, { instructions: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm bg-white" placeholder="Upload photos in the order you want them used" /></div>
              <label className="flex items-center gap-2 text-xs text-gray-700"><input type="checkbox" checked={template.isActive !== false} onChange={e => updateCollageTemplate(idx, { isActive: e.target.checked })} /> Active for customers</label>
            </div>
          ))}
          {form.collageEnabled && (form.collageTemplates || []).length === 0 && <p className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-500">No collage labels added. Add labels only for products that need multiple collage uploads.</p>}
          {!form.collageEnabled && <p className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-500">Collage uploads are disabled for this product.</p>}
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
              <input type="checkbox" checked={form.isBestSeller}
                onChange={e => setForm(p => ({ ...p, isBestSeller: e.target.checked }))} />
              <span className="text-sm">Best Seller</span>
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
          <h2 className="font-bold text-lg">SEO</h2><p className="text-xs text-gray-500">SEO helps Google and shared links show a better title and description for this product.</p>
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
