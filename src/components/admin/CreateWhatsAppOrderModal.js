'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { FiX } from 'react-icons/fi';
import { parseWhatsAppCustomerDetails, validateParsedCustomer } from '@/lib/whatsappCustomerParse';
import { fromDatetimeLocalIst, toDatetimeLocalIst } from '@/lib/istTime';
import { buildComboPhotoSlots } from '@/lib/customizedCombo';
import AdminWebsitePhotoSlot from '@/components/admin/AdminWebsitePhotoSlot';

const emptyItem = () => ({
  productId: '',
  variant: '',
  quantity: 1,
  instructions: '',
  photos: [],
  customFieldValues: {},
  photoSlots: [],
});

function photoSlotCountForProduct(product) {
  const preview = product?.customizationPreview || {};
  const areas = Array.isArray(preview.areas) ? preview.areas.length : 0;
  const fileFields = (product?.customFields || []).filter((f) => String(f?.type || '') === 'file').length;
  const required = Math.max(0, Number(preview.requiredImageCount || 0));
  const max = Math.max(0, Number(preview.maxImageCount || 0));
  // Variant options that require image upload also imply at least one slot when configured
  const variantUploadHints = (product?.variants || []).flatMap((v) => v.options || [])
    .filter((o) => o?.requiresImageUpload).length;
  return Math.max(areas, fileFields, required, max, variantUploadHints > 0 ? 1 : 0, 0);
}

/**
 * Build photo slots from website product configuration (areas, counts, file custom fields).
 * Reuses AdminWebsitePhotoSlot / crop editor — does not hardcode product layouts.
 */
function buildCatalogPhotoSlots(product) {
  const preview = product?.customizationPreview || {};
  const areas = Array.isArray(preview.areas) ? preview.areas : [];
  const fileFields = (product?.customFields || []).filter((f) => String(f?.type || '') === 'file');
  const count = photoSlotCountForProduct(product);
  if (!count) return [];

  if (areas.length > 0) {
    return Array.from({ length: Math.max(count, areas.length) }, (_, index) => {
      const area = areas[index] || areas[areas.length - 1] || {};
      return {
        slotKey: `catalog-area-${index}`,
        label: area.label || `Photo ${index + 1}`,
        sizeLabel: area.width && area.height ? `${area.width}×${area.height} ${area.unit || 'inch'}` : '',
        frameImage: area.frameImage || preview.frameImage || '',
        instructions: area.instructions || preview.instructions || '',
        required: index < Math.max(Number(preview.requiredImageCount || 0), areas.filter((a) => a.required !== false).length)
          ? area.required !== false
          : false,
        photo: null,
        reference: null,
      };
    });
  }

  if (fileFields.length > 0) {
    const slots = fileFields.map((field, index) => ({
      slotKey: `catalog-field-${index}`,
      label: field.label || `Photo ${index + 1}`,
      sizeLabel: '',
      frameImage: preview.frameImage || '',
      instructions: preview.shortGuidance || preview.instructions || '',
      required: field.required === true,
      photo: null,
      reference: null,
      customFieldLabel: field.label,
    }));
    // If required/max counts exceed named file fields, add numbered slots
    while (slots.length < count) {
      const index = slots.length;
      slots.push({
        slotKey: `catalog-extra-${index}`,
        label: `Photo ${index + 1}`,
        sizeLabel: '',
        frameImage: preview.frameImage || '',
        instructions: preview.instructions || '',
        required: index < Number(preview.requiredImageCount || 0),
        photo: null,
        reference: null,
      });
    }
    return slots;
  }

  return Array.from({ length: count }, (_, index) => ({
    slotKey: `catalog-${index}`,
    label: `Photo ${index + 1}`,
    sizeLabel: '',
    frameImage: preview.frameImage || '',
    instructions: preview.instructions || preview.shortGuidance || '',
    required: index < Number(preview.requiredImageCount || 0),
    photo: null,
    reference: null,
  }));
}

const emptyCustomer = {
  customerName: '',
  phone: '',
  whatsappNumber: '',
  email: '',
  line1: '',
  line2: '',
  landmark: '',
  district: '',
  city: '',
  state: '',
  pincode: '',
};

export default function CreateWhatsAppOrderModal({ open, onClose, onCreated }) {
  const [products, setProducts] = useState([]);
  const [staff, setStaff] = useState([]);
  const [saving, setSaving] = useState(false);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookup, setLookup] = useState(null);
  const [pasteText, setPasteText] = useState('');
  const [parseMeta, setParseMeta] = useState({ warnings: [], unmatchedLines: [], confidence: {} });
  const [showParsedEditor, setShowParsedEditor] = useState(false);
  /** Staff must explicitly confirm extracted/pasted/reused details before save. */
  const [customerDetailsReviewed, setCustomerDetailsReviewed] = useState(false);
  /** Set when fields came from paste extract or address lookup — review required regardless of clearing paste. */
  const [customerSource, setCustomerSource] = useState(''); // '' | 'paste' | 'lookup'
  /** catalog = existing Select Product; customized_combo = sizes from Website frame product */
  const [productMode, setProductMode] = useState('customized_combo');
  const [comboProduct, setComboProduct] = useState(null);
  const [comboSizes, setComboSizes] = useState([]);
  const [comboSelections, setComboSelections] = useState([]); // [{ size, quantity, isCustom }]
  const [comboSlotsConfirmed, setComboSlotsConfirmed] = useState(false);
  const [comboPhotoSlots, setComboPhotoSlots] = useState([]);
  const [customSizeDraft, setCustomSizeDraft] = useState('');
  const [paymentScreenshot, setPaymentScreenshot] = useState(null);
  const [form, setForm] = useState({
    orderSource: 'whatsapp',
    customerKind: 'new',
    historicalWhatsAppOrderRef: '',
    ...emptyCustomer,
    manualComboPrice: '',
    shippingCost: '0',
    otherCharges: '0',
    advancePayment: '',
    paymentMethod: 'UPI',
    paymentReference: '',
    paymentVerified: false,
    paymentDate: toDatetimeLocalIst(new Date()),
    previewRequired: 'no',
    orderPriority: 'normal',
    expectedDispatchDate: '',
    assignedTo: '',
    internalNotes: '',
    items: [emptyItem()],
  });

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const all = [];
        let page = 1;
        let total = Infinity;
        while (all.length < total && page <= 20) {
          const res = await fetch(`/api/products?all=true&limit=100&page=${page}`, { cache: 'no-store' });
          const d = await res.json();
          const batch = d.products || [];
          all.push(...batch);
          total = Number(d.total) || all.length;
          if (!batch.length) break;
          page += 1;
        }
        if (!cancelled) setProducts(all);
        if (!cancelled && Number.isFinite(total) && all.length < total) {
          toast.error(`Loaded ${all.length} of ${total} products — some may be missing`);
        }
      } catch {
        if (!cancelled) toast.error('Unable to load products');
      }
    })();
    fetch('/api/admin/staff', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { staff: [] }))
      .then((d) => { if (!cancelled) setStaff(d.staff || []); })
      .catch(() => { if (!cancelled) setStaff([]); });
    fetch('/api/admin/customized-combo', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.product) setComboProduct(d.product);
        setComboSizes(Array.isArray(d.sizes) ? d.sizes : []);
        if (d.error) toast.error(d.error);
      })
      .catch(() => { if (!cancelled) toast.error('Unable to load Customized Combo sizes'); });
    return () => { cancelled = true; };
  }, [open]);

  const orderTotalPreview = useMemo(() => {
    const combo = Number(String(form.manualComboPrice ?? '').trim());
    const ship = Number(String(form.shippingCost ?? '').trim());
    const other = Number(String(form.otherCharges ?? '').trim());
    if (!Number.isFinite(combo) || combo < 0) return null;
    const shipSafe = Number.isFinite(ship) && ship >= 0 ? ship : 0;
    const otherSafe = Number.isFinite(other) && other >= 0 ? other : 0;
    return Math.round((combo + shipSafe + otherSafe) * 100) / 100;
  }, [form.manualComboPrice, form.shippingCost, form.otherCharges]);

  if (!open) return null;

  const customerFieldKeys = new Set([
    'customerName', 'phone', 'whatsappNumber', 'line1', 'line2', 'landmark', 'district', 'city', 'state', 'pincode',
  ]);
  const setField = (key, value) => {
    if (customerFieldKeys.has(key)) setCustomerDetailsReviewed(false);
    setForm((prev) => ({ ...prev, [key]: value }));
  };
  const setItem = (index, key, value) => {
    setForm((prev) => {
      const items = [...prev.items];
      items[index] = { ...items[index], [key]: value };
      if (key === 'productId') items[index].variant = '';
      return { ...prev, items };
    });
  };

  const selectedProduct = (id) => products.find((p) => String(p._id) === String(id));

  const applyAddress = (addr) => {
    if (!addr) return;
    setForm((prev) => ({
      ...prev,
      customerName: addr.fullName || '',
      phone: addr.phone || '',
      whatsappNumber: addr.whatsappNumber || addr.phone || '',
      email: addr.email || '',
      line1: addr.line1 || '',
      line2: addr.line2 || '',
      landmark: addr.landmark || '',
      district: addr.district || '',
      city: addr.city || '',
      state: addr.state || '',
      pincode: addr.pincode || '',
    }));
    setShowParsedEditor(true);
    setCustomerSource('lookup');
    setCustomerDetailsReviewed(false);
    toast.success(`Address reused from ${addr.fromOrderNumber || 'previous order'} — review before saving`);
  };

  const runParse = (raw = pasteText) => {
    const result = parseWhatsAppCustomerDetails(raw);
    setParseMeta({
      warnings: result.warnings || [],
      unmatchedLines: result.unmatchedLines || [],
      confidence: result.confidence || {},
    });
    // Full replace — never merge with previous customer (prevents stale contamination)
    setForm((prev) => ({
      ...prev,
      customerName: result.fields.customerName || '',
      phone: result.fields.phone || '',
      whatsappNumber: result.fields.whatsappNumber || '',
      line1: result.fields.line1 || '',
      line2: result.fields.line2 || '',
      landmark: result.fields.landmark || '',
      district: result.fields.district || '',
      city: result.fields.city || '',
      state: result.fields.state || '',
      pincode: result.fields.pincode || '',
    }));
    setShowParsedEditor(true);
    setCustomerSource('paste');
    setCustomerDetailsReviewed(false);
    if (result.warnings?.length) {
      toast((result.warnings[0]), { icon: '⚠️' });
    } else {
      toast.success('Customer details extracted — review and confirm before saving');
    }
    return result;
  };

  const lookupPhone = async () => {
    const phone = String(form.phone || '').replace(/\D/g, '');
    if (phone.length < 10) {
      toast.error('Enter a valid phone number first');
      return;
    }
    setLookupBusy(true);
    setLookup(null);
    try {
      const res = await fetch(`/api/admin/orders/lookup?phone=${encodeURIComponent(phone)}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lookup failed');
      setLookup(data);
      if (data.matchedInDatabase && data.addresses?.[0]) {
        applyAddress(data.addresses[0]);
      } else if (!data.matchedInDatabase) {
        toast('No matching orders in website database for this phone', { icon: 'ℹ️' });
      }
    } catch (err) {
      toast.error(err.message || 'Lookup failed');
    } finally {
      setLookupBusy(false);
    }
  };

  const uploadItemPhotos = async (orderId, items) => {
    for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
      const slots = Array.isArray(items[itemIndex].photoSlots) ? items[itemIndex].photoSlots : [];
      if (slots.length) {
        for (let p = 0; p < slots.length; p += 1) {
          const slot = slots[p];
          const printFile = slot.photo?.file;
          if (printFile) {
            const body = new FormData();
            body.append('file', printFile);
            body.append('itemIndex', String(itemIndex));
            body.append('mode', 'append');
            body.append('slotLabel', slot.label || `Photo ${p + 1}`);
            body.append('slotKey', slot.slotKey || `catalog-${itemIndex}-${p}`);
            body.append('reason', 'Uploaded at WhatsApp order creation');
            const res = await fetch(`/api/admin/orders/${orderId}/photos`, { method: 'POST', body });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || `Photo upload failed for item ${itemIndex + 1}`);
          }
          const refFile = slot.reference?.file;
          if (refFile) {
            const refBody = new FormData();
            refBody.append('file', refFile);
            refBody.append('itemIndex', String(itemIndex));
            refBody.append('mode', 'append');
            refBody.append('slotLabel', `Reference — ${slot.label || `Photo ${p + 1}`}`);
            refBody.append('slotKey', `${slot.slotKey || `catalog-${itemIndex}-${p}`}-reference`);
            refBody.append('reason', 'Reference image at WhatsApp order creation');
            const refRes = await fetch(`/api/admin/orders/${orderId}/photos`, { method: 'POST', body: refBody });
            const refData = await refRes.json().catch(() => ({}));
            if (!refRes.ok) throw new Error(refData.error || `Reference upload failed for item ${itemIndex + 1}`);
          }
        }
        continue;
      }
      const photos = items[itemIndex].photos || [];
      for (let p = 0; p < photos.length; p += 1) {
        const file = photos[p];
        const body = new FormData();
        body.append('file', file);
        body.append('itemIndex', String(itemIndex));
        body.append('mode', 'append');
        body.append('slotLabel', 'Customer Photos');
        body.append('slotKey', `item-${itemIndex}-${p}`);
        body.append('reason', 'Uploaded at WhatsApp order creation');
        const res = await fetch(`/api/admin/orders/${orderId}/photos`, { method: 'POST', body });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Photo upload failed for item ${itemIndex + 1}`);
      }
    }
  };

  /** Upload each Customized Combo frame photo (and optional reference) mapped to size + frame. */
  const uploadComboSlotPhotos = async (orderId, slots) => {
    const sizeOrder = [];
    slots.forEach((slot) => {
      if (!sizeOrder.includes(slot.size)) sizeOrder.push(slot.size);
    });
    for (const slot of slots) {
      const printFile = slot.photo?.file || slot.file;
      if (!printFile) continue;
      const itemIndex = sizeOrder.indexOf(slot.size);
      const body = new FormData();
      body.append('file', printFile);
      body.append('itemIndex', String(Math.max(0, itemIndex)));
      body.append('mode', 'append');
      body.append('slotLabel', slot.label || `${slot.size} — Photo ${slot.frameIndex}`);
      body.append('slotKey', slot.slotKey || `combo-${slot.size}-${slot.frameIndex}`);
      body.append('reason', `Customized Combo ${slot.size} frame ${slot.frameIndex}`);
      const res = await fetch(`/api/admin/orders/${orderId}/photos`, { method: 'POST', body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Photo upload failed for ${slot.label}`);

      const refFile = slot.reference?.file;
      if (refFile) {
        const refBody = new FormData();
        refBody.append('file', refFile);
        refBody.append('itemIndex', String(Math.max(0, itemIndex)));
        refBody.append('mode', 'append');
        refBody.append('slotLabel', `Reference — ${slot.label || slot.size}`);
        refBody.append('slotKey', `${slot.slotKey || 'combo'}-reference`);
        refBody.append('reason', `Reference image for ${slot.size} frame ${slot.frameIndex}`);
        const refRes = await fetch(`/api/admin/orders/${orderId}/photos`, { method: 'POST', body: refBody });
        const refData = await refRes.json().catch(() => ({}));
        if (!refRes.ok) throw new Error(refData.error || `Reference upload failed for ${slot.label}`);
      }
    }
  };

  const confirmComboSizes = () => {
    const valid = comboSelections.filter((row) => row.size && Number(row.quantity) > 0);
    if (!valid.length) {
      toast.error('Add at least one size with quantity');
      return;
    }
    setComboSelections(valid);
    const frameImage = comboProduct?.customizationPreview?.frameImage || '';
    const instructions = comboProduct?.customizationPreview?.instructions
      || comboProduct?.customizationPreview?.shortGuidance
      || '';
    setComboPhotoSlots(buildComboPhotoSlots(valid).map((slot) => ({
      ...slot,
      frameImage,
      instructions,
      required: true,
    })));
    setComboSlotsConfirmed(true);
    toast.success('Photo slots generated — upload one customer photo per frame');
  };

  const submit = async (e) => {
    e.preventDefault();
    let working = form;
    // Never auto-save immediately after first parse — force staff review/correction first.
    if (String(pasteText || '').trim() && !String(form.customerName || '').trim() && !showParsedEditor) {
      runParse(pasteText);
      toast('Review the extracted fields, correct if needed, then create the order.', { icon: '✏️' });
      return;
    }
    const needsReview = Boolean(customerSource) || Boolean(String(pasteText || '').trim());
    if (needsReview && !showParsedEditor) {
      if (String(pasteText || '').trim() && !String(form.customerName || '').trim()) runParse(pasteText);
      else setShowParsedEditor(true);
      toast('Open and review the customer fields before creating the order.', { icon: '✏️' });
      return;
    }
    const uncertain = (parseMeta.warnings || []).length > 0
      || Object.values(parseMeta.confidence || {}).some((c) => c === 'low');
    if (needsReview && !customerDetailsReviewed) {
      toast.error(
        uncertain
          ? 'Parsing was uncertain — correct the fields and confirm review before saving'
          : 'Confirm you reviewed the customer details before saving',
      );
      setShowParsedEditor(true);
      return;
    }
    const validation = validateParsedCustomer(working);
    if (!validation.ok) {
      toast.error(validation.errors[0] || 'Fix customer details');
      setShowParsedEditor(true);
      return;
    }
    const comboRaw = String(form.manualComboPrice ?? '').trim();
    const combo = Number(comboRaw);
    if (!comboRaw || !Number.isFinite(combo) || combo < 0) {
      toast.error('Enter the overall customized combo / order price');
      return;
    }
    const shipRaw = String(form.shippingCost ?? '').trim();
    const ship = shipRaw === '' ? 0 : Number(shipRaw);
    if (!Number.isFinite(ship) || ship < 0) {
      toast.error('Shipping must be 0 or a positive amount');
      return;
    }
    const otherRaw = String(form.otherCharges ?? '').trim();
    const other = otherRaw === '' ? 0 : Number(otherRaw);
    if (!Number.isFinite(other) || other < 0) {
      toast.error('Other charges must be 0 or a positive amount');
      return;
    }
    let lineItems = form.items;
    if (productMode === 'customized_combo') {
      if (!comboProduct?._id) {
        toast.error('Customized Combo source product is not available');
        return;
      }
      if (!comboSelections.some((row) => row.size && Number(row.quantity) > 0)) {
        toast.error('Select at least one Customized Combo size and quantity');
        return;
      }
      if (!comboSlotsConfirmed) {
        toast.error('Confirm sizes with Done, then upload photos for each frame');
        return;
      }
      lineItems = comboSelections
        .filter((row) => row.size && Number(row.quantity) > 0)
        .map((row) => ({
          productId: comboProduct._id,
          variant: `Size: ${row.size}`,
          quantity: Number(row.quantity) || 1,
          instructions: '',
          photos: comboPhotoSlots
            .filter((slot) => slot.size === row.size && (slot.photo?.file || slot.file))
            .map((slot) => slot.photo?.file || slot.file),
          comboSlots: comboPhotoSlots.filter((slot) => slot.size === row.size),
        }));
    } else if (!form.items.some((item) => item.productId)) {
      toast.error('Select at least one product / size');
      return;
    }
    let paymentDateIso;
    const advanceAmount = Number(form.advancePayment) || 0;
    if (advanceAmount > 0) {
      if (!form.paymentDate) {
        toast.error('Payment date is required when recording advance payment');
        return;
      }
      if (!paymentScreenshot) {
        toast.error('Advance payment screenshot is required');
        return;
      }
    }
    if (form.paymentDate) {
      const paidAtDate = fromDatetimeLocalIst(form.paymentDate);
      if (!paidAtDate) {
        toast.error('Payment date/time is invalid');
        return;
      }
      paymentDateIso = paidAtDate.toISOString();
    }

    setSaving(true);
    try {
      const payload = {
        orderSource: form.orderSource,
        customerKind: form.customerKind,
        historicalWhatsAppOrderRef: form.customerKind === 'existing_whatsapp'
          ? form.historicalWhatsAppOrderRef
          : '',
        customerName: working.customerName,
        phone: validation.phone,
        whatsappNumber: working.whatsappNumber || validation.phone,
        email: working.email,
        line1: working.line1,
        line2: working.line2,
        landmark: working.landmark,
        district: working.district,
        city: working.city,
        state: working.state,
        pincode: validation.pincode,
        shippingCost: ship,
        otherCharges: other,
        manualPriceEntered: true,
        manualComboPrice: combo,
        advancePayment: advanceAmount,
        paymentMethod: form.paymentMethod,
        paymentReference: form.paymentReference,
        paymentVerified: form.paymentVerified,
        paymentDate: paymentDateIso,
        previewRequired: form.previewRequired === 'yes',
        orderPriority: form.orderPriority === 'urgent' ? 'urgent' : 'normal',
        expectedDispatchDate: form.expectedDispatchDate || undefined,
        assignedTo: form.assignedTo || undefined,
        internalNotes: form.internalNotes,
        items: lineItems.map((item) => ({
          productId: item.productId,
          variant: item.variant,
          quantity: Number(item.quantity) || 1,
          // Unit prices intentionally omitted — overall price is manualComboPrice
          customizationInstructions: item.instructions,
          customFields: item.customFieldValues || undefined,
          isCustomizedCombo: productMode === 'customized_combo',
        })),
      };
      const createBody = new FormData();
      createBody.append('payload', JSON.stringify(payload));
      if (advanceAmount > 0 && paymentScreenshot) {
        createBody.append('paymentScreenshot', paymentScreenshot);
      }
      const res = await fetch('/api/admin/orders', {
        method: 'POST',
        body: createBody,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create order');

      let photoError = '';
      if (data.order?._id) {
        try {
          if (productMode === 'customized_combo') {
            await uploadComboSlotPhotos(data.order._id, comboPhotoSlots);
          } else if (lineItems.some((item) => (
            (item.photos || []).length > 0
            || (item.photoSlots || []).some((s) => s?.photo?.file || s?.reference?.file)
          ))) {
            await uploadItemPhotos(data.order._id, lineItems);
          }
        } catch (uploadErr) {
          photoError = uploadErr?.message || 'Photo upload failed';
        }
      }

      toast.success(`Created ${data.order.orderNumber}`);
      onCreated?.(data.order);

      if (photoError) {
        // Keep modal open with photos so staff can retry — do not wipe local files
        toast.error(`Order saved, but photos failed: ${photoError}. Re-upload from this form or order detail.`);
        return;
      }

      onClose?.();
      setLookup(null);
      setPasteText('');
      setParseMeta({ warnings: [], unmatchedLines: [], confidence: {} });
      setShowParsedEditor(false);
      setCustomerDetailsReviewed(false);
      setCustomerSource('');
      setForm((prev) => ({
        ...prev,
        customerKind: 'new',
        historicalWhatsAppOrderRef: '',
        ...emptyCustomer,
        manualComboPrice: '',
        shippingCost: '0',
        otherCharges: '0',
        advancePayment: '',
        paymentReference: '',
        paymentVerified: false,
        paymentDate: toDatetimeLocalIst(new Date()),
        expectedDispatchDate: '',
        assignedTo: '',
        internalNotes: '',
        items: [emptyItem()],
      }));
      setPaymentScreenshot(null);
      setComboSelections([]);
      setComboPhotoSlots([]);
      setComboSlotsConfirmed(false);
      setCustomSizeDraft('');
    } catch (err) {
      toast.error(err.message || 'Create failed');
    } finally {
      setSaving(false);
    }
  };

  const confidenceHint = (key) => {
    const level = parseMeta.confidence?.[key];
    if (!level) return null;
    const color = level === 'high' ? 'text-green-700' : level === 'medium' ? 'text-amber-700' : 'text-red-700';
    return <span className={`ml-1 text-[10px] font-normal uppercase ${color}`}>{level}</span>;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="w-full max-w-3xl max-h-[92dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-4 py-3 sm:px-6">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Create WhatsApp Order</h2>
            <p className="text-xs text-gray-500">Paste customer details · manual combo price · unverified advance never counts as paid.</p>
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
                <option value="no">No — print after design upload</option>
                <option value="yes">Yes — wait for customer approval</option>
              </select>
            </label>
            <fieldset className="sm:col-span-2 rounded-xl border bg-gray-50 p-3">
              <legend className="px-1 text-sm font-bold text-gray-900">Customer</legend>
              <div className="flex flex-wrap gap-3 text-sm font-semibold">
                <label className="inline-flex items-center gap-2">
                  <input type="radio" name="customerKind" checked={form.customerKind === 'new'} onChange={() => setField('customerKind', 'new')} />
                  New customer
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="radio" name="customerKind" checked={form.customerKind === 'existing_whatsapp'} onChange={() => setField('customerKind', 'existing_whatsapp')} />
                  Existing WhatsApp customer
                </label>
              </div>
              {form.customerKind === 'existing_whatsapp' ? (
                <label className="mt-3 block text-sm font-semibold">
                  Previous WhatsApp order ID (reference only)
                  <input
                    value={form.historicalWhatsAppOrderRef}
                    onChange={(e) => setField('historicalWhatsAppOrderRef', e.target.value)}
                    placeholder="e.g. G1234 — does not need to exist in this database"
                    className="mt-1 w-full rounded-xl border px-3 py-2.5"
                  />
                </label>
              ) : null}
            </fieldset>
          </div>

          <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3 space-y-2">
            <label className="block text-sm font-bold text-gray-900">
              Paste Customer Details
              <textarea
                value={pasteText}
                onChange={(e) => {
                  setPasteText(e.target.value);
                  if (customerSource === 'paste') setCustomerDetailsReviewed(false);
                }}
                rows={7}
                placeholder={'Name\n9876543210\nAddress line…\nLandmark…\nCity\nState\n600001'}
                className="mt-2 w-full rounded-xl border border-emerald-200 bg-white px-3 py-2.5 font-mono text-sm leading-relaxed"
              />
            </label>
            <p className="text-[11px] text-gray-600">
              Paste the full WhatsApp message. Original text is kept until the order is saved successfully.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!String(pasteText || '').trim()}
                onClick={() => runParse()}
                className="min-h-[40px] rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Extract fields
              </button>
              <button
                type="button"
                onClick={() => setShowParsedEditor((v) => !v)}
                className="min-h-[40px] rounded-xl border bg-white px-4 py-2 text-sm font-semibold"
              >
                {showParsedEditor ? 'Hide' : 'Show'} structured fields
              </button>
            </div>
            {parseMeta.warnings?.length ? (
              <ul className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950 space-y-1">
                {parseMeta.warnings.map((w) => <li key={w}>• {w}</li>)}
              </ul>
            ) : null}
            {parseMeta.unmatchedLines?.length ? (
              <p className="text-[11px] text-gray-500">Unmatched lines kept for review: {parseMeta.unmatchedLines.join(' · ')}</p>
            ) : null}
            {(customerSource || String(pasteText || '').trim()) ? (
              <label className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={customerDetailsReviewed}
                  onChange={(e) => setCustomerDetailsReviewed(e.target.checked)}
                />
                <span>
                  I reviewed the customer details and corrected any mistakes.
                  {(parseMeta.warnings || []).length || Object.values(parseMeta.confidence || {}).some((c) => c === 'low')
                    ? ' Parsing was uncertain for some fields — do not save until corrected.'
                    : ''}
                </span>
              </label>
            ) : null}
          </div>

          {showParsedEditor ? (
            <div className="grid gap-3 rounded-xl border bg-white p-3 sm:grid-cols-2">
              <p className="sm:col-span-2 text-xs font-bold uppercase tracking-wide text-gray-500">Extracted details (editable)</p>
              <label className="text-sm font-semibold sm:col-span-2">Customer name{confidenceHint('customerName')}
                <input required value={form.customerName} onChange={(e) => setField('customerName', e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2.5" />
              </label>
              <label className="text-sm font-semibold">Phone{confidenceHint('phone')}
                <div className="mt-1 flex gap-2">
                  <input required value={form.phone} onChange={(e) => setField('phone', e.target.value)} className="min-w-0 flex-1 rounded-xl border px-3 py-2.5" />
                  <button type="button" disabled={lookupBusy} onClick={lookupPhone} className="shrink-0 rounded-xl border bg-white px-3 py-2 text-xs font-semibold disabled:opacity-50">
                    {lookupBusy ? '…' : 'Lookup'}
                  </button>
                </div>
              </label>
              <label className="text-sm font-semibold">WhatsApp{confidenceHint('whatsappNumber')}
                <input value={form.whatsappNumber} onChange={(e) => setField('whatsappNumber', e.target.value)} placeholder="Same as phone if empty" className="mt-1 w-full rounded-xl border px-3 py-2.5" />
              </label>
              {lookup?.matchedInDatabase ? (
                <div className="sm:col-span-2 rounded-xl border border-sky-100 bg-sky-50/70 p-3 text-xs text-gray-700 space-y-2">
                  <p className="font-semibold text-sky-900">Found {lookup.orderCount} previous order(s) in website database</p>
                  {lookup.addresses?.length > 1 ? (
                    <div className="flex flex-wrap gap-2">
                      {lookup.addresses.map((addr) => (
                        <button key={addr.fromOrderNumber} type="button" onClick={() => applyAddress(addr)} className="rounded-lg border bg-white px-2 py-1 font-semibold">
                          Reuse {addr.fromOrderNumber} address
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
              <label className="text-sm font-semibold sm:col-span-2">Address line 1{confidenceHint('line1')}
                <input required value={form.line1} onChange={(e) => setField('line1', e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2.5" />
              </label>
              <label className="text-sm font-semibold">Line 2{confidenceHint('line2')}
                <input value={form.line2} onChange={(e) => setField('line2', e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2.5" />
              </label>
              <label className="text-sm font-semibold">Landmark{confidenceHint('landmark')}
                <input value={form.landmark} onChange={(e) => setField('landmark', e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2.5" />
              </label>
              <label className="text-sm font-semibold">District{confidenceHint('district')}
                <input value={form.district} onChange={(e) => setField('district', e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2.5" />
              </label>
              <label className="text-sm font-semibold">City{confidenceHint('city')}
                <input required value={form.city} onChange={(e) => setField('city', e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2.5" />
              </label>
              <label className="text-sm font-semibold">State{confidenceHint('state')}
                <input required value={form.state} onChange={(e) => setField('state', e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2.5" />
              </label>
              <label className="text-sm font-semibold">Pincode{confidenceHint('pincode')}
                <input required value={form.pincode} onChange={(e) => setField('pincode', e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2.5" />
              </label>
            </div>
          ) : (
            <p className="text-xs text-gray-500">
              {form.customerName || form.phone
                ? `Ready: ${form.customerName || '—'} · ${form.phone || '—'} · ${form.city || '—'} ${form.pincode || ''}`
                : 'Extract or open structured fields before creating the order.'}
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold">Order priority
              <select value={form.orderPriority} onChange={(e) => setField('orderPriority', e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2.5">
                <option value="normal">Normal</option>
                <option value="urgent">Urgent</option>
              </select>
              {form.orderPriority === 'urgent' ? (
                <span className="mt-1 block text-[11px] font-semibold text-amber-700">
                  Urgent WhatsApp only — set Expected dispatch to the customer deadline. Does not change order creation date.
                </span>
              ) : null}
            </label>
            <label className="text-sm font-semibold">Expected dispatch
              <input type="date" value={form.expectedDispatchDate} onChange={(e) => setField('expectedDispatchDate', e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2.5" />
            </label>
            <label className="text-sm font-semibold">Override Editor (optional)
              <select value={form.assignedTo} onChange={(e) => setField('assignedTo', e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2.5">
                <option value="">Auto-assign lowest-workload Editor</option>
                {staff.map((a) => (
                  <option key={a._id || a.id} value={a._id || a.id}>{a.name || a.email}</option>
                ))}
              </select>
              <span className="mt-1 block text-[11px] font-normal text-gray-500">
                Leave blank for automatic Editor assignment. Manual pick overrides auto-assign.
              </span>
            </label>
          </div>

          <div className="space-y-3 rounded-xl border bg-gray-50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-bold text-gray-900">Products / Customized Combo</h3>
              <div className="flex gap-2 text-xs font-semibold">
                <button
                  type="button"
                  className={`rounded-lg px-3 py-1.5 ${productMode === 'customized_combo' ? 'bg-emerald-700 text-white' : 'border bg-white'}`}
                  onClick={() => { setProductMode('customized_combo'); setComboSlotsConfirmed(false); }}
                >
                  Customized Combo
                </button>
                <button
                  type="button"
                  className={`rounded-lg px-3 py-1.5 ${productMode === 'catalog' ? 'bg-emerald-700 text-white' : 'border bg-white'}`}
                  onClick={() => setProductMode('catalog')}
                >
                  Select Product
                </button>
              </div>
            </div>

            {productMode === 'customized_combo' ? (
              <div className="space-y-3">
                <p className="text-[11px] text-gray-600">
                  Sizes from Website product:{' '}
                  <strong>{comboProduct?.title || 'Personalized Single Photo Frame, Premium Frame with Matte Finish'}</strong>
                  . Select any number of sizes and quantities, then Done to generate one photo upload per frame.
                </p>
                {comboSelections.map((row, index) => (
                  <div key={`combo-${index}`} className="grid gap-2 rounded-xl border bg-white p-3 sm:grid-cols-3">
                    <label className="text-sm font-semibold sm:col-span-2">Size
                      {row.isCustom ? (
                        <input
                          value={row.size}
                          onChange={(e) => {
                            const size = e.target.value;
                            setComboSelections((prev) => prev.map((r, i) => (i === index ? { ...r, size } : r)));
                            setComboSlotsConfirmed(false);
                          }}
                          placeholder="e.g. 12x10"
                          className="mt-1 w-full rounded-xl border px-3 py-2.5"
                        />
                      ) : (
                        <select
                          value={row.size}
                          onChange={(e) => {
                            const size = e.target.value;
                            setComboSelections((prev) => prev.map((r, i) => (i === index ? { ...r, size } : r)));
                            setComboSlotsConfirmed(false);
                          }}
                          className="mt-1 w-full rounded-xl border px-3 py-2.5"
                        >
                          <option value="">Select size</option>
                          {comboSizes.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      )}
                      {row.isCustom ? (
                        <span className="mt-1 block text-[10px] font-normal text-amber-800">
                          Order-specific size — not saved to website product
                        </span>
                      ) : null}
                    </label>
                    <label className="text-sm font-semibold">Qty
                      <input
                        type="number"
                        min="1"
                        value={row.quantity}
                        onChange={(e) => {
                          setComboSelections((prev) => prev.map((r, i) => (i === index ? { ...r, quantity: e.target.value } : r)));
                          setComboSlotsConfirmed(false);
                        }}
                        className="mt-1 w-full rounded-xl border px-3 py-2.5"
                      />
                    </label>
                    <button
                      type="button"
                      className="sm:col-span-3 text-left text-xs font-semibold text-red-700"
                      onClick={() => {
                        setComboSelections((prev) => prev.filter((_, i) => i !== index));
                        setComboSlotsConfirmed(false);
                      }}
                    >
                      Remove size
                    </button>
                  </div>
                ))}
                <div className="flex flex-wrap items-end gap-2">
                  <button
                    type="button"
                    className="rounded-xl border bg-white px-3 py-2 text-sm font-semibold"
                    onClick={() => {
                      setComboSelections((prev) => [...prev, { size: '', quantity: 1, isCustom: false }]);
                      setComboSlotsConfirmed(false);
                    }}
                  >
                    + Add website size
                  </button>
                  <label className="text-xs font-semibold text-gray-700">
                    Additional size (order only)
                    <span className="mt-1 flex gap-2">
                      <input
                        value={customSizeDraft}
                        onChange={(e) => setCustomSizeDraft(e.target.value)}
                        placeholder="12x10"
                        className="min-h-[40px] rounded-xl border px-3 py-2 text-sm font-normal"
                      />
                      <button
                        type="button"
                        className="rounded-xl border bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900"
                        onClick={() => {
                          const size = String(customSizeDraft || '').trim();
                          if (!size) {
                            toast.error('Enter a custom size label');
                            return;
                          }
                          setComboSelections((prev) => [...prev, { size, quantity: 1, isCustom: true }]);
                          setCustomSizeDraft('');
                          setComboSlotsConfirmed(false);
                        }}
                      >
                        Add size
                      </button>
                    </span>
                  </label>
                  <button
                    type="button"
                    className="rounded-xl bg-emerald-700 px-3 py-2 text-sm font-semibold text-white"
                    onClick={confirmComboSizes}
                  >
                    Done — generate photo slots
                  </button>
                </div>
                {comboSlotsConfirmed && comboPhotoSlots.length > 0 ? (
                  <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/30 p-3">
                    <p className="text-xs font-bold text-gray-800">
                      Customer photos ({comboPhotoSlots.length} frames) — website-identical upload &amp; edit per frame
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {comboPhotoSlots.map((slot, slotIndex) => (
                        <AdminWebsitePhotoSlot
                          key={slot.slotKey}
                          label={slot.label}
                          sizeLabel={slot.size}
                          frameImage={slot.frameImage || ''}
                          instructions={slot.instructions || ''}
                          required
                          value={slot.photo || null}
                          referenceValue={slot.reference || null}
                          onChange={(photo) => setComboPhotoSlots((prev) => prev.map((s, i) => (
                            i === slotIndex
                              ? { ...s, photo, file: photo?.file || null, previewUrl: photo?.previewUrl || '' }
                              : s
                          )))}
                          onReferenceChange={(reference) => setComboPhotoSlots((prev) => prev.map((s, i) => (
                            i === slotIndex ? { ...s, reference } : s
                          )))}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
            <>
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-gray-500">Catalog product lines (existing Select Product flow).</p>
              <button type="button" className="text-sm font-semibold text-primary-700" onClick={() => setForm((p) => ({ ...p, items: [...p.items, emptyItem()] }))}>
                + Add size / product
              </button>
            </div>
            {form.items.map((item, index) => {
              const product = selectedProduct(item.productId);
              const variants = (product?.variants || []).flatMap((v) => (v.options || []).map((o) => `${v.name}: ${o.label}`));
              const customFields = (Array.isArray(product?.customFields) ? product.customFields : [])
                .filter((field) => field?.type !== 'file');
              const slots = Array.isArray(item.photoSlots) ? item.photoSlots : [];
              return (
                <div key={index} className="grid gap-2 rounded-xl border bg-white p-3 sm:grid-cols-2">
                  <div className="sm:col-span-2 flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Size / item {index + 1}</p>
                    {form.items.length > 1 ? (
                      <button
                        type="button"
                        className="text-xs font-semibold text-red-700"
                        onClick={() => setForm((p) => ({ ...p, items: p.items.filter((_, i) => i !== index) }))}
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                  <label className="text-sm font-semibold sm:col-span-2">Product
                    <select
                      required={productMode === 'catalog'}
                      value={item.productId}
                      onChange={(e) => {
                        const productId = e.target.value;
                        const nextProduct = products.find((p) => String(p._id) === String(productId));
                        setForm((prev) => {
                          const items = [...prev.items];
                          items[index] = {
                            ...items[index],
                            productId,
                            variant: '',
                            customFieldValues: {},
                            photoSlots: buildCatalogPhotoSlots(nextProduct),
                            photos: [],
                          };
                          return { ...prev, items };
                        });
                      }}
                      className="mt-1 w-full rounded-xl border px-3 py-2.5"
                    >
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
                      <input value={item.variant} onChange={(e) => setItem(index, 'variant', e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2.5" placeholder="No variants on this product" />
                    )}
                  </label>
                  <label className="text-sm font-semibold">Qty
                    <input type="number" min="1" value={item.quantity} onChange={(e) => setItem(index, 'quantity', e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2.5" />
                  </label>
                  {customFields.length ? (
                    <div className="sm:col-span-2 space-y-2 rounded-xl border border-primary-50 bg-primary-50/40 p-3">
                      <p className="text-xs font-bold text-gray-800">Product custom fields (from Website config)</p>
                      {customFields.map((field) => (
                        <label key={field.label} className="block text-sm font-semibold">
                          {field.label}{field.required ? ' *' : ''}
                          {field.type === 'textarea' ? (
                            <textarea
                              value={item.customFieldValues?.[field.label] || ''}
                              onChange={(e) => setForm((prev) => {
                                const items = [...prev.items];
                                items[index] = {
                                  ...items[index],
                                  customFieldValues: { ...(items[index].customFieldValues || {}), [field.label]: e.target.value },
                                };
                                return { ...prev, items };
                              })}
                              rows={2}
                              className="mt-1 w-full rounded-xl border bg-white px-3 py-2.5 font-normal"
                            />
                          ) : (
                            <input
                              value={item.customFieldValues?.[field.label] || ''}
                              onChange={(e) => setForm((prev) => {
                                const items = [...prev.items];
                                items[index] = {
                                  ...items[index],
                                  customFieldValues: { ...(items[index].customFieldValues || {}), [field.label]: e.target.value },
                                };
                                return { ...prev, items };
                              })}
                              className="mt-1 w-full rounded-xl border bg-white px-3 py-2.5 font-normal"
                            />
                          )}
                        </label>
                      ))}
                    </div>
                  ) : null}
                  <label className="text-sm font-semibold sm:col-span-2">Customization instructions
                    <textarea value={item.instructions} onChange={(e) => setItem(index, 'instructions', e.target.value)} rows={2} className="mt-1 w-full rounded-xl border px-3 py-2.5" />
                  </label>
                  {slots.length > 0 ? (
                    <div className="sm:col-span-2 space-y-2">
                      <p className="text-xs font-bold text-gray-800">
                        Customer photos ({slots.length}) — from Website product photo configuration
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {slots.map((slot, slotIndex) => (
                          <AdminWebsitePhotoSlot
                            key={slot.slotKey}
                            label={slot.label}
                            sizeLabel={slot.sizeLabel}
                            frameImage={slot.frameImage}
                            instructions={slot.instructions}
                            required={slot.required !== false}
                            value={slot.photo || null}
                            referenceValue={slot.reference || null}
                            onChange={(photo) => setForm((prev) => {
                              const items = [...prev.items];
                              const nextSlots = [...(items[index].photoSlots || [])];
                              nextSlots[slotIndex] = { ...nextSlots[slotIndex], photo };
                              items[index] = {
                                ...items[index],
                                photoSlots: nextSlots,
                                photos: nextSlots.map((s) => s.photo?.file).filter(Boolean),
                              };
                              return { ...prev, items };
                            })}
                            onReferenceChange={(reference) => setForm((prev) => {
                              const items = [...prev.items];
                              const nextSlots = [...(items[index].photoSlots || [])];
                              nextSlots[slotIndex] = { ...nextSlots[slotIndex], reference };
                              items[index] = { ...items[index], photoSlots: nextSlots };
                              return { ...prev, items };
                            })}
                          />
                        ))}
                      </div>
                    </div>
                  ) : product ? (
                    <p className="sm:col-span-2 text-[11px] text-gray-500">
                      This Website product has no configured photo slots. Photos can still be added later in Order Details.
                    </p>
                  ) : null}
                </div>
              );
            })}
            </>
            )}
          </div>

          <div className="grid gap-3 rounded-xl border border-amber-100 bg-amber-50/40 p-3 sm:grid-cols-2">
            <label className="text-sm font-bold text-gray-900 sm:col-span-2">
              Overall customized combo price (manual) *
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={form.manualComboPrice}
                onChange={(e) => setField('manualComboPrice', e.target.value)}
                placeholder="Enter total combo price agreed with customer"
                className="mt-1 w-full rounded-xl border border-amber-200 bg-white px-3 py-2.5 font-semibold"
              />
              <span className="mt-1 block text-[11px] font-normal text-gray-600">
                Not calculated from website product prices. This value is stored on the order and not auto-overwritten.
              </span>
            </label>
            <label className="text-sm font-semibold">Shipping cost
              <input type="number" min="0" step="0.01" value={form.shippingCost} onChange={(e) => setField('shippingCost', e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2.5" />
            </label>
            <label className="text-sm font-semibold">Other charges
              <input type="number" min="0" step="0.01" value={form.otherCharges} onChange={(e) => setField('otherCharges', e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2.5" />
            </label>
            <p className="sm:col-span-2 rounded-lg border bg-white px-3 py-2 text-sm">
              Amount owed:{' '}
              <strong>
                {orderTotalPreview != null ? `₹${orderTotalPreview.toLocaleString('en-IN')}` : '—'}
              </strong>
              <span className="ml-2 text-xs font-normal text-gray-500">
                (combo ₹{Number(form.manualComboPrice) || 0} + shipping ₹{Number(form.shippingCost) || 0}
                {Number(form.otherCharges) > 0 ? ` + other ₹${Number(form.otherCharges)}` : ''})
              </span>
            </p>
            <label className="text-sm font-semibold">Advance payment
              <input type="number" min="0" step="0.01" value={form.advancePayment} onChange={(e) => setField('advancePayment', e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2.5" />
            </label>
            <label className="text-sm font-semibold">Payment date & time (IST)
              <input type="datetime-local" value={form.paymentDate} onChange={(e) => setField('paymentDate', e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2.5" />
            </label>
            <label className="text-sm font-semibold">Payment method
              <input value={form.paymentMethod} onChange={(e) => setField('paymentMethod', e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2.5" />
            </label>
            <label className="text-sm font-semibold">Payment reference
              <input value={form.paymentReference} onChange={(e) => setField('paymentReference', e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2.5" />
            </label>
            <label className="text-sm font-semibold sm:col-span-2">
              Advance payment screenshot {(Number(form.advancePayment) || 0) > 0 ? '*' : '(required when advance > 0)'}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setPaymentScreenshot(e.target.files?.[0] || null)}
                className="mt-1 block w-full text-sm"
              />
              {paymentScreenshot ? (
                <span className="mt-1 block text-[11px] font-normal text-gray-600">Selected: {paymentScreenshot.name}</span>
              ) : (
                <span className="mt-1 block text-[11px] font-normal text-amber-800">
                  Screenshot is mandatory whenever an advance amount is entered. Uploading does not verify payment.
                </span>
              )}
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold pt-2 sm:col-span-2">
              <input type="checkbox" checked={form.paymentVerified} onChange={(e) => setField('paymentVerified', e.target.checked)} />
              Mark advance verified (separate authorized action — optional at create)
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
