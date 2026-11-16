'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { FiX } from 'react-icons/fi';
import { parseWhatsAppCustomerDetails, validateParsedCustomer } from '@/lib/whatsappCustomerParse';
import { fromDatetimeLocalIst, toDatetimeLocalIst } from '@/lib/istTime';
import { buildComboPhotoSlots } from '@/lib/customizedCombo';
import { expectedDeliveryFromDispatchYmd } from '@/lib/whatsappOrderDates';
import { sanitizeDecimalInput, sanitizeIntegerInput } from '@/lib/sanitizeNumericInput';
import AdminWebsitePhotoSlot from '@/components/admin/AdminWebsitePhotoSlot';

const emptyItem = () => ({
  productId: '',
  variant: '',
  variantId: '',
  quantity: '1',
  instructions: '',
  photos: [],
  customFieldValues: {},
  photoSlots: [],
});

function photoSlotCountForProduct(product) {
  const preview = product?.customizationPreview || {};
  if (preview.enabled === false && preview.uploadEnabled === false) return 0;
  const areas = Array.isArray(preview.areas) ? preview.areas.length : 0;
  const fileFields = (product?.customFields || []).filter((f) => String(f?.type || '') === 'file').length;
  const required = Math.max(0, Number(preview.requiredImageCount || 0));
  const max = Math.max(0, Number(preview.maxImageCount || 0));
  const variantUploadHints = (product?.variants || []).flatMap((v) => v.options || [])
    .filter((o) => o?.requiresImageUpload).length;
  return Math.max(areas, fileFields, required, max, variantUploadHints > 0 ? 1 : 0, 0);
}

function previewEnabledForProduct(product) {
  const preview = product?.customizationPreview || {};
  if (preview.enabled === false) return false;
  if (preview.previewEnabled === false) return false;
  return true;
}

/**
 * Build base photo slots from website product configuration.
 */
function buildCatalogPhotoSlots(product) {
  const preview = product?.customizationPreview || {};
  if (preview.uploadEnabled === false && preview.enabled === false) return [];
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
        allowPreview: previewEnabledForProduct(product),
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
      allowPreview: previewEnabledForProduct(product),
    }));
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
        allowPreview: previewEnabledForProduct(product),
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
    allowPreview: previewEnabledForProduct(product),
  }));
}

/** Expand website slots × quantity (one unit may need multiple labeled photos). */
function buildCatalogPhotoSlotsForItem(product, quantity, variantLabel = '') {
  const base = buildCatalogPhotoSlots(product);
  if (!base.length) return [];
  const qty = Math.max(1, Number(quantity) || 1);
  const slots = [];
  for (let unit = 1; unit <= qty; unit += 1) {
    base.forEach((slot) => {
      slots.push({
        ...slot,
        photo: null,
        reference: null,
        unitIndex: unit,
        variantLabel,
        slotKey: `${slot.slotKey}-u${unit}`,
        label: qty > 1
          ? `${variantLabel ? `${variantLabel} — ` : ''}Frame ${unit}${base.length > 1 ? ` · ${slot.label}` : ''}`
          : (variantLabel ? `${variantLabel} — ${slot.label}` : slot.label),
        sizeLabel: slot.sizeLabel || variantLabel || '',
      });
    });
  }
  return slots;
}

function mergeSlotsPreserveUploads(nextSlots = [], prevSlots = []) {
  const byKey = Object.fromEntries((prevSlots || []).map((s) => [s.slotKey, s]));
  return (nextSlots || []).map((slot) => {
    const prev = byKey[slot.slotKey];
    if (!prev) return slot;
    return {
      ...slot,
      photo: prev.photo || null,
      reference: prev.reference || null,
      file: prev.file || prev.photo?.file || null,
      previewUrl: prev.previewUrl || prev.photo?.previewUrl || '',
    };
  });
}

function listVariantOptions(product) {
  return (product?.variants || []).flatMap((v) => (v.options || []).map((o) => ({
    value: `${v.name}: ${o.label}`,
    label: `${v.name}: ${o.label}`,
    variantName: v.name || '',
    optionLabel: o.label || '',
    optionId: o._id || o.sku || `${v.name}:${o.label}`,
    requiresImageUpload: Boolean(o.requiresImageUpload),
  })));
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

const fieldClass = 'mt-1 w-full min-h-[44px] rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-base sm:text-sm';
const labelClass = 'block text-sm font-semibold text-gray-900';

export default function CreateWhatsAppOrderModal({ open, onClose, onCreated }) {
  const [products, setProducts] = useState([]);
  const [editors, setEditors] = useState([]);
  const [proposedEditor, setProposedEditor] = useState(null);
  const [holidays, setHolidays] = useState([]);
  const [saving, setSaving] = useState(false);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookup, setLookup] = useState(null);
  const [pasteText, setPasteText] = useState('');
  const [parseMeta, setParseMeta] = useState({ warnings: [], unmatchedLines: [], confidence: {} });
  const [showParsedEditor, setShowParsedEditor] = useState(false);
  const [customerDetailsReviewed, setCustomerDetailsReviewed] = useState(false);
  const [customerSource, setCustomerSource] = useState('');
  const [productMode, setProductMode] = useState('customized_combo');
  const [comboProduct, setComboProduct] = useState(null);
  const [comboSizes, setComboSizes] = useState([]);
  const [comboSelections, setComboSelections] = useState([]);
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
    fetch('/api/admin/editors', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { editors: [] }))
      .then((d) => {
        if (cancelled) return;
        setEditors(d.editors || []);
        setProposedEditor(d.proposedEditor || null);
      })
      .catch(() => {
        if (!cancelled) {
          setEditors([]);
          setProposedEditor(null);
        }
      });
    fetch('/api/settings', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : {}))
      .then((d) => {
        if (!cancelled) setHolidays(Array.isArray(d.deliveryHolidays) ? d.deliveryHolidays : []);
      })
      .catch(() => { if (!cancelled) setHolidays([]); });
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

  // Auto-build combo photo slots whenever variants/qty change (no Done button).
  useEffect(() => {
    if (productMode !== 'customized_combo') return;
    const valid = comboSelections.filter((row) => row.size && Number(row.quantity) > 0);
    if (!valid.length) {
      setComboPhotoSlots([]);
      return;
    }
    const frameImage = comboProduct?.customizationPreview?.frameImage || '';
    const instructions = comboProduct?.customizationPreview?.instructions
      || comboProduct?.customizationPreview?.shortGuidance
      || '';
    const next = buildComboPhotoSlots(valid).map((slot) => ({
      ...slot,
      frameImage,
      instructions,
      required: true,
      allowPreview: previewEnabledForProduct(comboProduct),
    }));
    setComboPhotoSlots((prev) => mergeSlotsPreserveUploads(next, prev));
  }, [comboSelections, comboProduct, productMode]);

  const orderTotalPreview = useMemo(() => {
    const combo = Number(String(form.manualComboPrice ?? '').trim());
    const ship = Number(String(form.shippingCost ?? '').trim());
    const other = Number(String(form.otherCharges ?? '').trim());
    if (!Number.isFinite(combo) || combo < 0) return null;
    const shipSafe = Number.isFinite(ship) && ship >= 0 ? ship : 0;
    const otherSafe = Number.isFinite(other) && other >= 0 ? other : 0;
    return Math.round((combo + shipSafe + otherSafe) * 100) / 100;
  }, [form.manualComboPrice, form.shippingCost, form.otherCharges]);

  const deliveryPreview = useMemo(() => {
    if (!form.expectedDispatchDate) return null;
    return expectedDeliveryFromDispatchYmd(form.expectedDispatchDate, holidays);
  }, [form.expectedDispatchDate, holidays]);

  const priceLabel = productMode === 'customized_combo'
    ? 'Overall Customized Combo Price (Manual) *'
    : 'Overall Product Price *';

  if (!open) return null;

  const customerFieldKeys = new Set([
    'customerName', 'phone', 'whatsappNumber', 'line1', 'line2', 'landmark', 'district', 'city', 'state', 'pincode',
  ]);
  const setField = (key, value) => {
    if (customerFieldKeys.has(key)) setCustomerDetailsReviewed(false);
    setForm((prev) => ({ ...prev, [key]: value }));
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

  const updateCatalogItem = (index, patch) => {
    setForm((prev) => {
      const items = [...prev.items];
      const current = { ...items[index], ...patch };
      const product = products.find((p) => String(p._id) === String(current.productId));
      if (
        Object.prototype.hasOwnProperty.call(patch, 'productId')
        || Object.prototype.hasOwnProperty.call(patch, 'quantity')
        || Object.prototype.hasOwnProperty.call(patch, 'variant')
      ) {
        const nextSlots = buildCatalogPhotoSlotsForItem(product, current.quantity, current.variant);
        current.photoSlots = mergeSlotsPreserveUploads(nextSlots, items[index].photoSlots || []);
        current.photos = (current.photoSlots || []).map((s) => s.photo?.file).filter(Boolean);
      }
      items[index] = current;
      return { ...prev, items };
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    let working = form;
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
      toast.error(productMode === 'customized_combo'
        ? 'Enter the overall customized combo price'
        : 'Enter the overall product price');
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
    if (form.expectedDispatchDate) {
      const deliveryCalc = expectedDeliveryFromDispatchYmd(form.expectedDispatchDate, holidays);
      if (!deliveryCalc.ok) {
        toast.error(deliveryCalc.reason === 'dispatch_on_non_working_day'
          ? 'Expected dispatch must be a working day (not Sunday or an Admin holiday)'
          : 'Unable to calculate expected delivery from the selected dispatch date');
        return;
      }
    }
    let lineItems = form.items;
    if (productMode === 'customized_combo') {
      if (!comboProduct?._id) {
        toast.error('Customized Combo source product is not available');
        return;
      }
      if (!comboSelections.some((row) => row.size && Number(row.quantity) > 0)) {
        toast.error('Add at least one Customized Combo variant and quantity');
        return;
      }
      if (!comboPhotoSlots.length) {
        toast.error('Photo slots could not be generated for the selected variants');
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
      toast.error('Select at least one product and add a variant');
      return;
    } else if (!form.items.some((item) => item.productId && (item.variant || listVariantOptions(selectedProduct(item.productId)).length === 0))) {
      toast.error('Choose a variant for each selected product');
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
        orderSource: 'whatsapp',
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

      toast.success(`Created ${data.order.orderNumber}${data.order.assignedToName ? ` · ${data.order.assignedToName}` : ''}`);
      onCreated?.(data.order);

      if (photoError) {
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
        orderSource: 'whatsapp',
        customerKind: 'new',
        historicalWhatsAppOrderRef: '',
        ...emptyCustomer,
        manualComboPrice: '',
        shippingCost: '0',
        otherCharges: '0',
        advancePayment: '',
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
      <div className="flex w-full max-w-3xl max-h-[92dvh] flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b bg-white px-4 py-3 sm:px-6">
          <div className="min-w-0 pr-2">
            <h2 className="text-lg font-bold text-gray-900">Create WhatsApp Order</h2>
            <p className="text-xs text-gray-500">Manual WhatsApp order · website products · round-robin Editor.</p>
          </div>
          <button type="button" onClick={onClose} className="min-h-[44px] min-w-[44px] shrink-0 rounded-xl border p-2" aria-label="Close">
            <FiX size={18} />
          </button>
        </div>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className={labelClass}>
              Source
              <div className={`${fieldClass} flex items-center font-semibold text-emerald-800`}>WhatsApp</div>
            </div>
            <label className={labelClass}>Preview required
              <select value={form.previewRequired} onChange={(e) => setField('previewRequired', e.target.value)} className={fieldClass}>
                <option value="no">No — print after design upload</option>
                <option value="yes">Yes — wait for customer approval</option>
              </select>
            </label>
            <fieldset className="sm:col-span-2 rounded-xl border bg-gray-50 p-3">
              <legend className="px-1 text-sm font-bold text-gray-900">Customer</legend>
              <div className="flex flex-wrap gap-3 text-sm font-semibold">
                <label className="inline-flex min-h-[44px] items-center gap-2">
                  <input type="radio" name="customerKind" checked={form.customerKind === 'new'} onChange={() => setField('customerKind', 'new')} />
                  New customer
                </label>
                <label className="inline-flex min-h-[44px] items-center gap-2">
                  <input type="radio" name="customerKind" checked={form.customerKind === 'existing_whatsapp'} onChange={() => setField('customerKind', 'existing_whatsapp')} />
                  Existing WhatsApp customer
                </label>
              </div>
              {form.customerKind === 'existing_whatsapp' ? (
                <label className={`mt-3 ${labelClass}`}>
                  Previous WhatsApp order ID (reference only)
                  <input
                    value={form.historicalWhatsAppOrderRef}
                    onChange={(e) => setField('historicalWhatsAppOrderRef', e.target.value)}
                    placeholder="e.g. G1234 — does not need to exist in this database"
                    className={fieldClass}
                  />
                </label>
              ) : null}
            </fieldset>
          </div>

          <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3 space-y-2">
            <label className={`block ${labelClass}`}>
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
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!String(pasteText || '').trim()}
                onClick={() => runParse()}
                className="min-h-[44px] rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Extract fields
              </button>
              <button
                type="button"
                onClick={() => setShowParsedEditor((v) => !v)}
                className="min-h-[44px] rounded-xl border bg-white px-4 py-2 text-sm font-semibold"
              >
                {showParsedEditor ? 'Hide' : 'Show'} structured fields
              </button>
            </div>
            {parseMeta.warnings?.length ? (
              <ul className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950 space-y-1">
                {parseMeta.warnings.map((w) => <li key={w}>• {w}</li>)}
              </ul>
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
              <label className={`${labelClass} sm:col-span-2`}>Customer name{confidenceHint('customerName')}
                <input required value={form.customerName} onChange={(e) => setField('customerName', e.target.value)} className={fieldClass} />
              </label>
              <label className={labelClass}>Phone{confidenceHint('phone')}
                <div className="mt-1 flex gap-2">
                  <input required value={form.phone} onChange={(e) => setField('phone', e.target.value)} className="min-h-[44px] min-w-0 flex-1 rounded-xl border px-3 py-2.5 text-base sm:text-sm" />
                  <button type="button" disabled={lookupBusy} onClick={lookupPhone} className="min-h-[44px] shrink-0 rounded-xl border bg-white px-3 py-2 text-xs font-semibold disabled:opacity-50">
                    {lookupBusy ? '…' : 'Lookup'}
                  </button>
                </div>
              </label>
              <label className={labelClass}>WhatsApp{confidenceHint('whatsappNumber')}
                <input value={form.whatsappNumber} onChange={(e) => setField('whatsappNumber', e.target.value)} placeholder="Same as phone if empty" className={fieldClass} />
              </label>
              {lookup?.matchedInDatabase ? (
                <div className="sm:col-span-2 rounded-xl border border-sky-100 bg-sky-50/70 p-3 text-xs text-gray-700 space-y-2">
                  <p className="font-semibold text-sky-900">Found {lookup.orderCount} previous order(s) in website database</p>
                  {lookup.addresses?.length > 1 ? (
                    <div className="flex flex-wrap gap-2">
                      {lookup.addresses.map((addr) => (
                        <button key={addr.fromOrderNumber} type="button" onClick={() => applyAddress(addr)} className="min-h-[40px] rounded-lg border bg-white px-2 py-1 font-semibold">
                          Reuse {addr.fromOrderNumber} address
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
              <label className={`${labelClass} sm:col-span-2`}>Address line 1{confidenceHint('line1')}
                <input required value={form.line1} onChange={(e) => setField('line1', e.target.value)} className={fieldClass} />
              </label>
              <label className={labelClass}>Line 2{confidenceHint('line2')}
                <input value={form.line2} onChange={(e) => setField('line2', e.target.value)} className={fieldClass} />
              </label>
              <label className={labelClass}>Landmark{confidenceHint('landmark')}
                <input value={form.landmark} onChange={(e) => setField('landmark', e.target.value)} className={fieldClass} />
              </label>
              <label className={labelClass}>District{confidenceHint('district')}
                <input value={form.district} onChange={(e) => setField('district', e.target.value)} className={fieldClass} />
              </label>
              <label className={labelClass}>City{confidenceHint('city')}
                <input required value={form.city} onChange={(e) => setField('city', e.target.value)} className={fieldClass} />
              </label>
              <label className={labelClass}>State{confidenceHint('state')}
                <input required value={form.state} onChange={(e) => setField('state', e.target.value)} className={fieldClass} />
              </label>
              <label className={labelClass}>Pincode{confidenceHint('pincode')}
                <input required value={form.pincode} onChange={(e) => setField('pincode', e.target.value)} className={fieldClass} inputMode="numeric" />
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
            <label className={labelClass}>Order priority
              <select value={form.orderPriority} onChange={(e) => setField('orderPriority', e.target.value)} className={fieldClass}>
                <option value="normal">Normal</option>
                <option value="urgent">Urgent</option>
              </select>
            </label>
            <label className={labelClass}>Expected dispatch date
              <input
                type="date"
                value={form.expectedDispatchDate}
                onChange={(e) => setField('expectedDispatchDate', e.target.value)}
                className={fieldClass}
              />
            </label>
            <div className={`${labelClass} sm:col-span-2`}>
              Expected delivery date
              <div className={`${fieldClass} flex flex-col justify-center bg-gray-50 font-semibold text-gray-900`}>
                {deliveryPreview?.ok
                  ? `${deliveryPreview.deliveryLabel} (${deliveryPreview.deliveryYmd})`
                  : form.expectedDispatchDate
                    ? (deliveryPreview?.reason === 'dispatch_on_non_working_day'
                      ? 'Select a working day for dispatch (Sunday/holidays excluded)'
                      : 'Unable to calculate delivery')
                    : 'Select expected dispatch date'}
              </div>
              <span className="mt-1 block text-[11px] font-normal text-gray-500">
                Auto-calculated as dispatch + 2 eligible working days (Sundays & Admin holidays skipped).
              </span>
            </div>
            <label className={`${labelClass} sm:col-span-2`}>Override Editor (optional)
              <select value={form.assignedTo} onChange={(e) => setField('assignedTo', e.target.value)} className={fieldClass}>
                <option value="">
                  {proposedEditor?.name
                    ? `Auto round-robin (next: ${proposedEditor.name})`
                    : 'Auto-assign next Editor (round-robin)'}
                </option>
                {editors.map((editor) => (
                  <option key={editor._id || editor.id} value={editor._id || editor.id}>
                    {editor.name || editor.email}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-[11px] font-normal text-gray-500">
                Leave blank for automatic round-robin. Manual override does not advance the rotation cursor. Admin is not listed.
              </span>
              {!editors.length ? (
                <span className="mt-1 block text-[11px] font-semibold text-amber-800">
                  No active Editors found — create will warn until an Editor account is available.
                </span>
              ) : null}
            </label>
          </div>

          <div className="space-y-3 rounded-xl border bg-gray-50 p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="font-bold text-gray-900">Products / Customized Combo</h3>
              <div className="flex flex-wrap gap-2 text-xs font-semibold">
                <button
                  type="button"
                  className={`min-h-[40px] rounded-lg px-3 py-1.5 ${productMode === 'customized_combo' ? 'bg-emerald-700 text-white' : 'border bg-white'}`}
                  onClick={() => setProductMode('customized_combo')}
                >
                  Customized Combo
                </button>
                <button
                  type="button"
                  className={`min-h-[40px] rounded-lg px-3 py-1.5 ${productMode === 'catalog' ? 'bg-emerald-700 text-white' : 'border bg-white'}`}
                  onClick={() => setProductMode('catalog')}
                >
                  Select Product
                </button>
              </div>
            </div>

            {productMode === 'customized_combo' ? (
              <div className="space-y-3">
                <p className="text-[11px] text-gray-600">
                  Variants from configured Website product:{' '}
                  <strong>{comboProduct?.title || 'Loading…'}</strong>
                  . Upload slots appear automatically when you add a variant and quantity.
                </p>
                {comboSelections.map((row, index) => (
                  <div key={`combo-${index}`} className="grid gap-2 rounded-xl border bg-white p-3 sm:grid-cols-3">
                    <label className={`${labelClass} sm:col-span-2`}>Variant / size
                      {row.isCustom ? (
                        <input
                          value={row.size}
                          onChange={(e) => {
                            const size = e.target.value;
                            setComboSelections((prev) => prev.map((r, i) => (i === index ? { ...r, size } : r)));
                          }}
                          placeholder="e.g. 12x10"
                          className={fieldClass}
                        />
                      ) : (
                        <select
                          value={row.size}
                          onChange={(e) => {
                            const size = e.target.value;
                            setComboSelections((prev) => prev.map((r, i) => (i === index ? { ...r, size } : r)));
                          }}
                          className={fieldClass}
                        >
                          <option value="">Select variant</option>
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
                    <label className={labelClass}>Qty
                      <input
                        inputMode="numeric"
                        value={row.quantity}
                        onChange={(e) => {
                          const quantity = sanitizeIntegerInput(e.target.value);
                          setComboSelections((prev) => prev.map((r, i) => (i === index ? { ...r, quantity } : r)));
                        }}
                        className={fieldClass}
                      />
                    </label>
                    <button
                      type="button"
                      className="min-h-[40px] sm:col-span-3 text-left text-sm font-semibold text-red-700"
                      onClick={() => setComboSelections((prev) => prev.filter((_, i) => i !== index))}
                    >
                      Remove variant
                    </button>
                  </div>
                ))}
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
                  <button
                    type="button"
                    className="min-h-[44px] rounded-xl border border-emerald-300 bg-white px-4 py-2 text-sm font-bold text-emerald-800"
                    onClick={() => setComboSelections((prev) => [...prev, { size: '', quantity: '1', isCustom: false }])}
                  >
                    + Add Variant
                  </button>
                  <label className="text-xs font-semibold text-gray-700">
                    Additional size (order only)
                    <span className="mt-1 flex flex-col gap-2 sm:flex-row">
                      <input
                        value={customSizeDraft}
                        onChange={(e) => setCustomSizeDraft(e.target.value)}
                        placeholder="12x10"
                        className="min-h-[44px] rounded-xl border px-3 py-2 text-sm font-normal"
                      />
                      <button
                        type="button"
                        className="min-h-[44px] rounded-xl border bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900"
                        onClick={() => {
                          const size = String(customSizeDraft || '').trim();
                          if (!size) {
                            toast.error('Enter a custom size label');
                            return;
                          }
                          setComboSelections((prev) => [...prev, { size, quantity: '1', isCustom: true }]);
                          setCustomSizeDraft('');
                        }}
                      >
                        Add custom
                      </button>
                    </span>
                  </label>
                </div>
                {comboPhotoSlots.length > 0 ? (
                  <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/30 p-3">
                    <p className="text-xs font-bold text-gray-800">
                      Customer photos ({comboPhotoSlots.length} frames) — website upload &amp; preview editor
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
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-[11px] text-gray-500">Website catalog products. Add one variant row per size/option.</p>
                  <button
                    type="button"
                    className="min-h-[44px] rounded-xl border border-emerald-300 bg-white px-4 py-2 text-sm font-bold text-emerald-800"
                    onClick={() => setForm((p) => {
                      const last = p.items[p.items.length - 1];
                      const next = emptyItem();
                      if (last?.productId) {
                        next.productId = last.productId;
                        next.photoSlots = buildCatalogPhotoSlotsForItem(
                          products.find((prod) => String(prod._id) === String(last.productId)),
                          1,
                          '',
                        );
                      }
                      return { ...p, items: [...p.items, next] };
                    })}
                  >
                    + Add Variant
                  </button>
                </div>
                {form.items.map((item, index) => {
                  const product = selectedProduct(item.productId);
                  const variants = listVariantOptions(product);
                  const customFields = (Array.isArray(product?.customFields) ? product.customFields : [])
                    .filter((field) => field?.type !== 'file');
                  const slots = Array.isArray(item.photoSlots) ? item.photoSlots : [];
                  return (
                    <div key={index} className="grid gap-2 rounded-xl border bg-white p-3 sm:grid-cols-2">
                      <div className="sm:col-span-2 flex items-center justify-between gap-2">
                        <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Variant {index + 1}</p>
                        {form.items.length > 1 ? (
                          <button
                            type="button"
                            className="min-h-[40px] text-sm font-semibold text-red-700"
                            onClick={() => setForm((p) => ({ ...p, items: p.items.filter((_, i) => i !== index) }))}
                          >
                            Remove variant
                          </button>
                        ) : null}
                      </div>
                      <label className={`${labelClass} sm:col-span-2`}>Product
                        <select
                          required={productMode === 'catalog'}
                          value={item.productId}
                          onChange={(e) => updateCatalogItem(index, {
                            productId: e.target.value,
                            variant: '',
                            variantId: '',
                            customFieldValues: {},
                          })}
                          className={fieldClass}
                        >
                          <option value="">Select product</option>
                          {products.map((p) => (
                            <option key={p._id} value={p._id}>{p.title}</option>
                          ))}
                        </select>
                      </label>
                      <label className={labelClass}>Variant / size
                        {variants.length ? (
                          <select
                            value={item.variant}
                            onChange={(e) => {
                              const value = e.target.value;
                              const match = variants.find((v) => v.value === value);
                              updateCatalogItem(index, {
                                variant: value,
                                variantId: match?.optionId || '',
                              });
                            }}
                            className={fieldClass}
                          >
                            <option value="">Select variant</option>
                            {variants.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
                          </select>
                        ) : (
                          <input
                            value={item.variant}
                            onChange={(e) => updateCatalogItem(index, { variant: e.target.value })}
                            className={fieldClass}
                            placeholder={product ? 'No variants on this product' : 'Select a product first'}
                          />
                        )}
                      </label>
                      <label className={labelClass}>Qty
                        <input
                          inputMode="numeric"
                          value={item.quantity}
                          onChange={(e) => updateCatalogItem(index, { quantity: sanitizeIntegerInput(e.target.value) })}
                          className={fieldClass}
                        />
                      </label>
                      {customFields.length ? (
                        <div className="sm:col-span-2 space-y-2 rounded-xl border border-primary-50 bg-primary-50/40 p-3">
                          <p className="text-xs font-bold text-gray-800">Product custom fields (from Website config)</p>
                          {customFields.map((field) => (
                            <label key={field.label} className={`block ${labelClass}`}>
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
                                  className={`${fieldClass} font-normal`}
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
                                  className={`${fieldClass} font-normal`}
                                />
                              )}
                            </label>
                          ))}
                        </div>
                      ) : null}
                      <label className={`${labelClass} sm:col-span-2`}>Customization instructions
                        <textarea
                          value={item.instructions}
                          onChange={(e) => updateCatalogItem(index, { instructions: e.target.value })}
                          rows={2}
                          className={fieldClass}
                        />
                      </label>
                      {slots.length > 0 ? (
                        <div className="sm:col-span-2 space-y-2">
                          <p className="text-xs font-bold text-gray-800">
                            Customer photos ({slots.length}) — from Website product configuration
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
            <label className={`${labelClass} sm:col-span-2`}>
              {priceLabel}
              <input
                required
                inputMode="decimal"
                value={form.manualComboPrice}
                onChange={(e) => setField('manualComboPrice', sanitizeDecimalInput(e.target.value))}
                placeholder="Enter total price agreed with customer"
                className="mt-1 w-full min-h-[44px] rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-base font-semibold sm:text-sm"
              />
              <span className="mt-1 block text-[11px] font-normal text-gray-600">
                Manual amount — not calculated from website catalog unit prices.
              </span>
            </label>
            <label className={labelClass}>Shipping cost
              <input
                inputMode="decimal"
                value={form.shippingCost}
                onChange={(e) => setField('shippingCost', sanitizeDecimalInput(e.target.value))}
                className={fieldClass}
              />
            </label>
            <label className={labelClass}>Other charges
              <input
                inputMode="decimal"
                value={form.otherCharges}
                onChange={(e) => setField('otherCharges', sanitizeDecimalInput(e.target.value))}
                className={fieldClass}
              />
            </label>
            <p className="sm:col-span-2 rounded-lg border bg-white px-3 py-2 text-sm">
              Amount owed:{' '}
              <strong>
                {orderTotalPreview != null ? `₹${orderTotalPreview.toLocaleString('en-IN')}` : '—'}
              </strong>
            </p>
            <label className={labelClass}>Advance payment
              <input
                inputMode="decimal"
                value={form.advancePayment}
                onChange={(e) => setField('advancePayment', sanitizeDecimalInput(e.target.value))}
                className={fieldClass}
              />
            </label>
            <label className={labelClass}>Payment date & time (IST)
              <input type="datetime-local" value={form.paymentDate} onChange={(e) => setField('paymentDate', e.target.value)} className={fieldClass} />
            </label>
            <label className={`${labelClass} sm:col-span-2`}>Payment method
              <input value={form.paymentMethod} onChange={(e) => setField('paymentMethod', e.target.value)} className={fieldClass} />
            </label>
            <label className={`${labelClass} sm:col-span-2`}>
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
                  Screenshot is mandatory whenever an advance amount is entered.
                </span>
              )}
            </label>
            <label className="flex min-h-[44px] items-center gap-2 text-sm font-semibold sm:col-span-2">
              <input type="checkbox" checked={form.paymentVerified} onChange={(e) => setField('paymentVerified', e.target.checked)} />
              Mark advance verified (optional at create)
            </label>
            <label className={`${labelClass} sm:col-span-2`}>Internal notes
              <textarea value={form.internalNotes} onChange={(e) => setField('internalNotes', e.target.value)} rows={2} className={fieldClass} />
            </label>
          </div>

        </div>
          <div className="flex shrink-0 flex-col-reverse gap-2 border-t bg-white px-4 py-3 sm:flex-row sm:justify-end sm:px-6">
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
