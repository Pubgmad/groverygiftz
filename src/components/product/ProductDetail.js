'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { formatPrice, calcSavings, getEffectivePrice, isOfferActive, getVariantRegularPrice, getVariantSalePrice, getVariantEffectivePrice } from '@/lib/utils';
import { buildDeliveryEstimateText } from '@/lib/deliveryDate';
import { buildProductMetaPayload, trackMetaCustomEvent, trackMetaEvent } from '@/lib/metaPixel';
import { FiMinus, FiPlus, FiX, FiTruck, FiShield, FiClock, FiShoppingCart, FiZap, FiUpload, FiImage, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import toast from 'react-hot-toast';
const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand',
  'West Bengal', 'Delhi', 'Jammu & Kashmir', 'Ladakh', 'Puducherry',
];

const isTamilNadu = (state) => String(state || '').trim().toLowerCase() === 'tamil nadu';
const getStateOverride = (delivery, state) => (delivery?.stateOverrides || []).find((row) => String(row.state || '').trim().toLowerCase() === String(state || '').trim().toLowerCase());
const getDefaultPreviewAdjustments = () => ({ zoom: 1, x: 0, y: 0, orientation: 'auto' });
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export default function ProductDetail({ product }) {
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selectedVariants, setSelectedVariants] = useState({});
  const [customFieldValues, setCustomFieldValues] = useState({});
  const [customerPhotos, setCustomerPhotos] = useState([]);
  const [uploadingCustomerPhotos, setUploadingCustomerPhotos] = useState(false);
  const [uploadingFields, setUploadingFields] = useState({});
  const [previewAdjustments, setPreviewAdjustments] = useState({});
  const [giftWrap, setGiftWrap] = useState(false);
  const [giftMessage, setGiftMessage] = useState('');
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [sizeChartOpen, setSizeChartOpen] = useState(false);
  const [settings, setSettings] = useState({ freeShippingThreshold: 499, whatsapp: '919994549781', tamilNaduShippingCost: 0, otherStateShippingCost: 120, tamilNaduDeliveryEstimate: 'Within 8 days', otherStateDeliveryEstimate: '10-15 days' });
  const { addToCart, setIsCartOpen } = useCart();
  const router = useRouter();
  const viewedProductRef = useRef('');
  const customTextTrackedRef = useRef({});
  const dragStateRef = useRef(null);
  const galleryTouchRef = useRef({ startX: 0, endX: 0 });
  const lightboxTouchRef = useRef({ startX: 0, endX: 0 });
  const [selectedDeliveryState, setSelectedDeliveryState] = useState('');

  const offerActive = isOfferActive(product);
  const isSoldOut = Number(product.stock) <= 0;
  const mediaItems = [
    ...(product.images || []).map((url) => ({ type: 'image', url })),
    ...(product.productVideo?.url ? [{ type: 'video', url: product.productVideo.url, name: product.productVideo.name || 'Product video' }] : []),
  ];
  const currentMedia = mediaItems[selectedImage] || mediaItems[0];
  const imageItems = mediaItems.filter((item) => item.type === 'image');
  const goToMedia = (idx) => setSelectedImage((idx + mediaItems.length) % mediaItems.length);
  const goNextMedia = () => { if (mediaItems.length > 1) goToMedia(selectedImage + 1); };
  const goPrevMedia = () => { if (mediaItems.length > 1) goToMedia(selectedImage - 1); };
  const handleGalleryTouchStart = (event) => { galleryTouchRef.current = { startX: event.touches?.[0]?.clientX || 0, endX: event.touches?.[0]?.clientX || 0 }; };
  const handleGalleryTouchMove = (event) => { galleryTouchRef.current.endX = event.touches?.[0]?.clientX || galleryTouchRef.current.endX; };
  const handleGalleryTouchEnd = () => { const diff = galleryTouchRef.current.startX - galleryTouchRef.current.endX; if (Math.abs(diff) > 45) diff > 0 ? goNextMedia() : goPrevMedia(); };
  const handleLightboxTouchStart = (event) => { lightboxTouchRef.current = { startX: event.touches?.[0]?.clientX || 0, endX: event.touches?.[0]?.clientX || 0 }; };
  const handleLightboxTouchMove = (event) => { lightboxTouchRef.current.endX = event.touches?.[0]?.clientX || lightboxTouchRef.current.endX; };
  const handleLightboxTouchEnd = () => { const diff = lightboxTouchRef.current.startX - lightboxTouchRef.current.endX; if (Math.abs(diff) > 45) diff > 0 ? goNextMedia() : goPrevMedia(); };
  const previewConfig = product.customizationPreview || {};
  const previewEnabled = !!previewConfig.enabled;
  const legacyPreviewArea = previewConfig.enabled ? [{
    label: previewConfig.title || 'Photo 1',
    width: Number(String(previewConfig.aspectRatio || '1:1').split(':')[0]) || 1,
    height: Number(String(previewConfig.aspectRatio || '1:1').split(':')[1]) || 1,
    unit: 'ratio',
    frameImage: previewConfig.frameImage || '',
    shape: previewConfig.shape || 'rectangle',
    required: Number(previewConfig.requiredImageCount || 0) > 0,
    instructions: previewConfig.instructions || '',
  }] : [];
  const previewAreas = previewEnabled
    ? ((Array.isArray(previewConfig.areas) && previewConfig.areas.length > 0) ? previewConfig.areas : legacyPreviewArea)
    : [];
  const requiredPhotoCount = Math.max(0, previewAreas.filter((area) => area.required !== false).length || Number(previewConfig.requiredImageCount || 0));
  const maxPhotoCount = Math.max(requiredPhotoCount, previewAreas.length || Number(previewConfig.maxImageCount || requiredPhotoCount || 0));
  const needsCustomerPhotos = requiredPhotoCount > 0 || maxPhotoCount > 0;

  const getOptionExtraPrice = (opt) => opt?.useOwnPrice ? 0 : Number(opt?.priceAdjustment ?? opt?.price ?? 0);
  const getOptionRegularPrice = getVariantRegularPrice;
  const getOptionSalePrice = getVariantSalePrice;
  const getOptionEffectivePrice = getVariantEffectivePrice;
  useEffect(() => {
    const firstVariantWithOption = (product.variants || [])
      .map((variant) => ({
        variant,
        option: (variant.options || []).find((opt) => opt?.label && opt.inStock !== false && !(typeof opt.stock === 'number' && opt.stock <= 0)),
      }))
      .find((entry) => entry.variant?.name && entry.option);

    if (!firstVariantWithOption) {
      setSelectedVariants({});
      return;
    }

    const { variant, option } = firstVariantWithOption;
    setSelectedVariants({
      [variant.name]: {
        label: option.label,
        extra: getOptionExtraPrice(option),
        useOwnPrice: !!option.useOwnPrice,
        regularPrice: option.regularPrice,
        salePrice: option.salePrice,
        stateOverrides: option.stateOverrides || [],
      },
    });
  }, [product._id, product.variants]);
  const selectedVariantOptions = Object.values(selectedVariants).filter(Boolean);
  const selectedOwnPriceOption = selectedVariantOptions.find((selected) => selected?.useOwnPrice && getOptionRegularPrice(selected) > 0);
  const baseRegularPrice = selectedOwnPriceOption ? getOptionRegularPrice(selectedOwnPriceOption) : Number(product.regularPrice || 0);
  const baseSalePrice = selectedOwnPriceOption ? getOptionSalePrice(selectedOwnPriceOption) : Number(product.salePrice || 0);
  const baseOfferActive = selectedOwnPriceOption ? (baseSalePrice > 0 && baseSalePrice < baseRegularPrice) : offerActive;
  const baseDisplayPrice = baseOfferActive ? baseSalePrice : baseRegularPrice;
  const selectedVariantExtra = selectedVariantOptions.reduce((sum, selected) => sum + (selected?.useOwnPrice ? 0 : Number(selected?.extra || 0)), 0);
  const giftWrapPrice = giftWrap && product.giftWrap?.enabled ? Number(product.giftWrap.price || 0) : 0;
  const finalUnitPrice = baseDisplayPrice + selectedVariantExtra + giftWrapPrice;
  const compareAtPrice = baseRegularPrice + selectedVariantExtra + giftWrapPrice;
  const savings = compareAtPrice > finalUnitPrice ? compareAtPrice - finalUnitPrice : 0;
  const price = baseDisplayPrice;
  const productDelivery = product.delivery || {};
  const usesProductDelivery = !!productDelivery.useCustomDelivery;
  const tamilNaduDeliveryCost = usesProductDelivery ? Number(productDelivery.tamilNaduShippingCost || 0) : Number(settings.tamilNaduShippingCost || 0);
  const getSelectedVariantShippingOverride = (state) => selectedVariantOptions
    .flatMap((selected) => selected?.stateOverrides || [])
    .find((row) => String(row.state || '').trim().toLowerCase() === String(state || '').trim().toLowerCase());
  const getProductShippingForState = (state) => {
    if (!state) return { cost: 0, estimate: 'Select state to see delivery estimate' };
    const variantOverride = getSelectedVariantShippingOverride(state);
    if (variantOverride?.state) return { cost: Number(variantOverride.shippingCost || 0), estimate: variantOverride.deliveryEstimate || '' };
    if (usesProductDelivery) {
      const override = getStateOverride(productDelivery, state);
      if (override?.state) return { cost: Number(override.shippingCost || 0), estimate: override.deliveryEstimate || '' };
      if (isTamilNadu(state)) return { cost: Number(productDelivery.tamilNaduShippingCost || 0), estimate: productDelivery.tamilNaduDeliveryEstimate || settings.tamilNaduDeliveryEstimate || 'Within 8 days' };
      return { cost: Number(productDelivery.otherStateShippingCost || 0), estimate: productDelivery.otherStateDeliveryEstimate || settings.otherStateDeliveryEstimate || '10-15 days' };
    }
    return isTamilNadu(state)
      ? { cost: Number(settings.tamilNaduShippingCost || 0), estimate: settings.tamilNaduDeliveryEstimate || 'Within 8 days' }
      : { cost: Number(settings.otherStateShippingCost || 0), estimate: settings.otherStateDeliveryEstimate || '10-15 days' };
  };
  const selectedDelivery = getProductShippingForState(selectedDeliveryState);
  const productPageTotal = finalUnitPrice * quantity + selectedDelivery.cost;
  const getAreaAspectRatio = (area, orientation = 'auto') => {
    const rawWidth = Math.max(1, Number(area?.width || 1));
    const rawHeight = Math.max(1, Number(area?.height || 1));
    const width = orientation === 'portrait' ? Math.min(rawWidth, rawHeight) : orientation === 'landscape' ? Math.max(rawWidth, rawHeight) : rawWidth;
    const height = orientation === 'portrait' ? Math.max(rawWidth, rawHeight) : orientation === 'landscape' ? Math.min(rawWidth, rawHeight) : rawHeight;
    return width + ' / ' + height;
  };
  const getAreaAdjustments = (idx) => ({ ...getDefaultPreviewAdjustments(), ...(previewAdjustments[idx] || {}) });
  const updateAreaAdjustments = (idx, updates) => setPreviewAdjustments((prev) => ({ ...prev, [idx]: { ...getDefaultPreviewAdjustments(), ...(prev[idx] || {}), ...updates } }));
  const updateAreaAdjustment = (idx, key, value) => updateAreaAdjustments(idx, { [key]: value });
  const startPreviewDrag = (idx, event) => {
    const current = getAreaAdjustments(idx);
    dragStateRef.current = { idx, startX: event.clientX, startY: event.clientY, x: current.x, y: current.y };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const movePreviewDrag = (event) => {
    const drag = dragStateRef.current;
    if (!drag) return;
    updateAreaAdjustments(drag.idx, {
      x: clamp(drag.x + event.clientX - drag.startX, -160, 160),
      y: clamp(drag.y + event.clientY - drag.startY, -160, 160),
    });
  };
  const stopPreviewDrag = () => { dragStateRef.current = null; };
  const getProductPixelPayload = (extra = {}) => buildProductMetaPayload(product, {
    price: finalUnitPrice,
    quantity,
    value: finalUnitPrice * quantity,
    ...extra,
  });

  useEffect(() => {
    if (viewedProductRef.current === product._id) return;
    viewedProductRef.current = product._id;
    trackMetaEvent('ViewContent', buildProductMetaPayload(product, { price, value: price }));
  }, [price, product]);

  const trackCustomTextInput = (fieldLabel, value) => {
    setCustomFieldValues((prev) => ({ ...prev, [fieldLabel]: value }));
    if (!String(value || '').trim() || customTextTrackedRef.current[fieldLabel]) return;
    customTextTrackedRef.current[fieldLabel] = true;
    trackMetaCustomEvent('CustomizeProduct', getProductPixelPayload({ customization_type: 'text', field_label: fieldLabel }));
  };

  const validateSelections = () => {
    if (!product.isQuoteOnly && !selectedDeliveryState) {
      toast.error('Please select your delivery state to see the final price');
      return false;
    }
    if ((product.variants || []).length > 0 && selectedVariantOptions.length === 0) {
      toast.error('Please select one variant option');
      return false;
    }
    for (const field of product.customFields || []) {
      if (field.required && !customFieldValues[field.label]) {
        toast.error(`Please fill required field: ${field.label}`);
        return false;
      }
    }
    if (needsCustomerPhotos && customerPhotos.length < requiredPhotoCount) {
      toast.error(`Please upload ${requiredPhotoCount} customer photo${requiredPhotoCount === 1 ? '' : 's'} for this product`);
      return false;
    }
    if (maxPhotoCount > 0 && customerPhotos.length > maxPhotoCount) {
      toast.error(`Please upload no more than ${maxPhotoCount} photo${maxPhotoCount === 1 ? '' : 's'}`);
      return false;
    }
    return true;
  };

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((d) => {
        setSettings({
          freeShippingThreshold: Number(d.freeShippingThreshold ?? 499),
          whatsapp: d.whatsapp || '919994549781',
          tamilNaduShippingCost: Number(d.tamilNaduShippingCost ?? 0),
          otherStateShippingCost: Number(d.otherStateShippingCost ?? d.shippingCost ?? 120),
          tamilNaduDeliveryEstimate: d.tamilNaduDeliveryEstimate || 'Within 8 days',
          otherStateDeliveryEstimate: d.otherStateDeliveryEstimate || '10-15 days',
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const savedState = window.localStorage?.getItem('groveryDeliveryState');
    if (savedState) setSelectedDeliveryState(savedState);
  }, []);

  useEffect(() => {
    if (selectedDeliveryState) window.localStorage?.setItem('groveryDeliveryState', selectedDeliveryState);
  }, [selectedDeliveryState]);

  const handleCustomizationFileUpload = async (fieldLabel, file) => {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    setUploadingFields((prev) => ({ ...prev, [fieldLabel]: true }));
    try {
      const res = await fetch('/api/customization-upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setCustomFieldValues((prev) => ({ ...prev, [fieldLabel]: data }));
      toast.success('Customization file uploaded');
      trackMetaCustomEvent('CustomizeProduct', getProductPixelPayload({ customization_type: 'file_upload', field_label: fieldLabel, file_type: data.type || file.type || '' }));
    } catch (error) {
      setCustomFieldValues((prev) => ({ ...prev, [fieldLabel]: '' }));
      toast.error(error.message || 'Failed to upload file');
    } finally {
      setUploadingFields((prev) => ({ ...prev, [fieldLabel]: false }));
    }
  };
const handleCustomerPhotoUpload = async (files) => {
    const selectedFiles = Array.from(files || []);
    if (selectedFiles.length === 0) return;
    const remainingSlots = maxPhotoCount > 0 ? maxPhotoCount - customerPhotos.length : selectedFiles.length;
    if (remainingSlots <= 0) {
      toast.error(`Maximum ${maxPhotoCount} photos allowed for this product`);
      return;
    }
    if (maxPhotoCount > 0 && selectedFiles.length > remainingSlots) {
      toast.error(`Please upload exactly the requested photos. You can add ${remainingSlots} more photo${remainingSlots === 1 ? '' : 's'} for this product.`);
      return;
    }
    const filesToUpload = selectedFiles;
    setUploadingCustomerPhotos(true);
    try {
      const uploaded = [];
      for (const file of filesToUpload) {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/customization-upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Failed to upload ${file.name}`);
        uploaded.push(data);
      }
      setCustomerPhotos((prev) => [...prev, ...uploaded]);
      toast.success(`${uploaded.length} photo${uploaded.length === 1 ? '' : 's'} uploaded`);
      trackMetaCustomEvent('CustomizeProduct', getProductPixelPayload({ customization_type: 'customer_photos', photo_count: uploaded.length }));
    } catch (error) {
      toast.error(error.message || 'Failed to upload photos');
    } finally {
      setUploadingCustomerPhotos(false);
    }
  };

  const addConfiguredProductToCart = ({ openCart = true } = {}) => {
    if (isSoldOut) {
      toast.error('This product is currently sold out');
      return false;
    }
    if (!validateSelections()) return false;

    if (product.isQuoteOnly) {
      trackMetaEvent('Contact', getProductPixelPayload({ contact_method: 'quote_whatsapp' }));
      window.open(`https://wa.me/${settings.whatsapp}?text=Hi, I'm interested in: ${product.title}`, '_blank');
      return false;
    }
    const variantStr = Object.entries(selectedVariants).filter(([, v]) => v?.label).map(([k, v]) => `${k}: ${v.label}`).join(', ');
    const allCustomFields = customerPhotos.length > 0 ? { ...customFieldValues, 'Customer Photos': customerPhotos } : customFieldValues;

    addToCart({
      productId: product._id,
      title: product.title,
      image: product.images?.[0] || '',
      images: product.images || [],
      price: finalUnitPrice,
      quantity,
      variant: variantStr,
      customFields: allCustomFields,
      giftWrap,
      giftMessage,
      delivery: product.delivery || null,
      variantDelivery: { stateOverrides: selectedVariantOptions.flatMap((selected) => selected?.stateOverrides || []) },
      deliveryState: selectedDeliveryState,
      customizationPreview: previewEnabled && previewAreas.some((area, idx) => customerPhotos[idx]?.url) ? {
        previewTitle: previewConfig.title || 'Customization preview',
        previews: previewAreas.map((area, idx) => ({
          areaLabel: area.label || ('Photo ' + (idx + 1)),
          width: area.width || '',
          height: area.height || '',
          unit: area.unit || 'inch',
          shape: area.shape || 'rectangle',
          instructions: area.instructions || '',
          frameImage: area.frameImage || '',
          uploadedFile: customerPhotos[idx] || null,
          adjustments: getAreaAdjustments(idx),
        })).filter((entry) => entry.uploadedFile?.url),
      } : null,
    }, { openDrawer: openCart });
    trackMetaEvent('AddToCart', getProductPixelPayload());
    if (Object.keys(allCustomFields || {}).length > 0 || giftWrap || giftMessage.trim()) {
      trackMetaCustomEvent('CustomizeProduct', getProductPixelPayload({ customization_type: 'configured_product' }));
    }
    return true;
  };

  const handleAddToCart = () => {
    if (addConfiguredProductToCart({ openCart: true })) toast.success('Added to cart!');
  };

  const handleBuyNow = () => {
    if (!addConfiguredProductToCart({ openCart: false })) return;
    setIsCartOpen(false);
    toast.success('Taking you to checkout...');
    router.push('/checkout');
  };

  return (
    <div className="grid md:grid-cols-2 gap-8 md:gap-12">
      {/* Product Media Gallery */}
      <div>
        <div className="relative aspect-square rounded-2xl overflow-hidden bg-gray-100 mb-4 cursor-pointer" onClick={() => currentMedia?.type === 'image' && setLightboxOpen(true)} onTouchStart={handleGalleryTouchStart} onTouchMove={handleGalleryTouchMove} onTouchEnd={handleGalleryTouchEnd}>
          {currentMedia?.type === 'video' ? (
            <video src={currentMedia.url} controls className="w-full h-full object-contain bg-black" />
          ) : currentMedia?.url ? (
            <img src={currentMedia.url} alt={product.title} className="w-full h-full object-contain bg-white" onError={(e) => { e.currentTarget.src = '/placeholder.svg'; }} />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">No media</div>
          )}
          {mediaItems.length > 1 && (
            <>
              <button type="button" onClick={(e) => { e.stopPropagation(); goPrevMedia(); }} className="absolute left-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-gray-800 shadow-lg transition hover:bg-white md:flex" aria-label="Previous product media"><FiChevronLeft size={22} /></button>
              <button type="button" onClick={(e) => { e.stopPropagation(); goNextMedia(); }} className="absolute right-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-gray-800 shadow-lg transition hover:bg-white md:flex" aria-label="Next product media"><FiChevronRight size={22} /></button>
              <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-black/25 px-2 py-1 backdrop-blur-sm">
                {mediaItems.map((_, idx) => <span key={idx} className={`h-1.5 rounded-full transition-all ${idx === selectedImage ? 'w-5 bg-white' : 'w-1.5 bg-white/60'}`} />)}
              </div>
            </>
          )}
        </div>
        {mediaItems.length > 1 && (
          <div className="flex gap-2 overflow-x-auto">
            {mediaItems.map((media, idx) => (
              <button key={media.type + '-' + idx} onClick={() => setSelectedImage(idx)}
                className={"relative w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 border-2 bg-gray-100 " + (idx === selectedImage ? 'border-primary-600' : 'border-transparent')}>
                {media.type === 'video' ? (
                  <div className="w-full h-full flex items-center justify-center bg-gray-900 text-white text-xs font-bold">Video</div>
                ) : (
                  <img src={media.url} alt="" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.src = '/placeholder.svg'; }} />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Product Info */}
      <div>
        <h1 className="text-2xl md:text-3xl font-display font-bold mb-4">{product.title}</h1>

        <div className="flex flex-wrap items-center gap-3 mb-4">
          <span className="text-3xl font-bold text-primary-600">{formatPrice(finalUnitPrice)}</span>
          {savings > 0 && (
            <>
              <span className="text-xl text-gray-400 line-through">{formatPrice(compareAtPrice)}</span>
              <span className="badge-save text-sm">Save {formatPrice(savings)}</span>
              {product.offerEndsAt && <span className="inline-flex items-center gap-1 rounded-full bg-accent-50 px-3 py-1 text-xs font-extrabold text-accent-700"><FiClock size={12} /> Offer ends {new Date(product.offerEndsAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
            </>
          )}
        </div>

        {!product.isQuoteOnly && (
          <div className="mb-4 rounded-2xl border border-primary-100 bg-white p-4 shadow-sm">
            <label className="block text-sm font-bold text-gray-900 mb-2">Select delivery state</label>
            <select value={selectedDeliveryState} onChange={(e) => setSelectedDeliveryState(e.target.value)} className="w-full rounded-xl border px-4 py-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 bg-white">
              <option value="">Choose your state to see final price</option>
              {INDIAN_STATES.map((state) => <option key={state} value={state}>{state}</option>)}
            </select>
            <div className="mt-3 rounded-xl bg-primary-50/70 px-4 py-3 text-sm">
              {selectedDeliveryState ? (
                <div className="space-y-1">
                  <div className="flex justify-between gap-3"><span>Product price</span><span className="font-semibold">{formatPrice(finalUnitPrice * quantity)}</span></div>
                  <div className="flex justify-between gap-3"><span>Delivery charge</span><span className="font-semibold">{selectedDelivery.cost === 0 ? 'FREE' : formatPrice(selectedDelivery.cost)}</span></div>
                  <div className="flex justify-between gap-3 border-t border-primary-100 pt-2 text-base font-bold"><span>Total for {selectedDeliveryState}</span><span className="text-primary-700">{formatPrice(productPageTotal)}</span></div>
                  <p className="text-xs text-gray-500">Estimated delivery: <span className="font-semibold text-gray-800">{selectedDelivery.estimate}</span></p>
                </div>
              ) : (
                <p className="text-gray-600">Tamil Nadu delivery is free. Other state shipment cost varies and will be shown after state selection.</p>
              )}
            </div>
          </div>
        )}

        <div className="bg-primary-50/60 rounded-xl px-4 py-3 mb-6 space-y-2">
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <FiTruck size={14} className="text-primary-600 shrink-0" />
            <span>Free Delivery Across Tamil Nadu. Shipping charges for other states will be calculated after selecting your state.</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <FiClock size={14} className="text-primary-600 shrink-0" />
            <span>Tamil Nadu Delivery: Within 8 working days | Other States: Within 10-15 working days</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <FiShield size={14} className="text-primary-600 shrink-0" />
            <span>100% Safe & Secure Payments</span>
          </div>
          {isSoldOut ? (
            <p className="text-red-600 font-semibold text-sm">Out of stock</p>
          ) : Number(product.stock) > 0 && Number(product.stock) <= 15 ? (
            <p className="text-amber-800 font-semibold text-sm flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center rounded-md bg-amber-100 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-amber-900">
                Almost gone
              </span>
              Only {product.stock} in stock - order soon!
            </p>
          ) : Number(product.stock) > 0 && Number(product.stock) <= 40 ? (
            <p className="text-accent-700 font-semibold text-sm">
              {product.stock} in stock - selling fast
            </p>
          ) : Number(product.stock) > 0 ? (
            <p className="text-gray-600 text-sm">{product.stock} in stock</p>
          ) : null}
        </div>

        {/* Variants */}
        {product.variants?.map((variant, vIdx) => (
          <div key={vIdx} className="mb-4">
            <div className="flex items-center gap-3 mb-2">
              <label className="font-semibold text-sm">
                {variant.name} {selectedVariants[variant.name]?.label && `(${selectedVariants[variant.name].label})`}
              </label>
              {variant.name.toLowerCase() === 'size' && (
                <button onClick={() => setSizeChartOpen(true)} className="text-xs text-primary-600 underline hover:text-primary-700">
                  Size Chart
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {variant.options?.map((opt, oIdx) => {
                const extra = getOptionExtraPrice(opt);
                const optionSoldOut = opt.inStock === false || (typeof opt.stock === 'number' && opt.stock <= 0);
                const optionRegularPrice = getOptionRegularPrice(opt);
                const optionEffectivePrice = getOptionEffectivePrice(opt);
                const selected = selectedVariants[variant.name]?.label === opt.label;
                return (
                  <button key={oIdx}
                    type="button"
                    disabled={optionSoldOut}
                    onClick={() => setSelectedVariants(prev => { const selectedNow = prev[variant.name]?.label === opt.label; if (selectedNow) return {}; return { [variant.name]: { label: opt.label, extra, useOwnPrice: !!opt.useOwnPrice, regularPrice: opt.regularPrice, salePrice: opt.salePrice, stateOverrides: opt.stateOverrides || [] } }; })}
                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      selected
                        ? 'border-primary-600 bg-primary-50 text-primary-600'
                        : optionSoldOut
                          ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    {opt.label}
                    {opt.useOwnPrice && optionRegularPrice > 0 ? ` ${formatPrice(optionEffectivePrice)}` : extra > 0 && ` (+${formatPrice(extra)})`}
                    {optionSoldOut && ' (Sold out)'}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Custom Fields */}
        {product.customFields?.map((field, fIdx) => (
          <div key={fIdx} className="mb-4">
            <label className="block font-semibold text-sm mb-2">
              {field.label}{field.required && '*'}
            </label>
            {field.type === 'textarea' ? (
              <textarea
                className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:border-primary-500"
                rows={3}
                onChange={e => trackCustomTextInput(field.label, e.target.value)}
              />
            ) : field.type === 'file' ? (
              <div className="rounded-2xl border-2 border-dashed border-primary-200 bg-primary-50/40 p-4">
                <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl bg-white px-4 py-5 text-center hover:bg-primary-50 transition-colors">
                  <FiUpload size={24} className="text-primary-600" />
                  <span className="text-sm font-semibold text-gray-800">Upload photo or artwork</span>
                  <span className="text-xs text-gray-500">JPG, PNG, WEBP, GIF or PDF up to 200 MB</span>
                  <input type="file" accept="image/*,.pdf" className="sr-only"
                    onChange={e => handleCustomizationFileUpload(field.label, e.target.files?.[0])} />
                </label>
                {uploadingFields[field.label] && <p className="mt-2 text-xs font-semibold text-primary-600">Uploading...</p>}
                {customFieldValues[field.label]?.url && (
                  <div className="mt-3 flex items-center gap-3 rounded-xl bg-white border border-primary-100 p-3">
                    <FiImage size={18} className="text-accent-500 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-800">{customFieldValues[field.label].name}</p>
                      <a href={customFieldValues[field.label].url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-primary-600 hover:text-primary-700">Preview uploaded file</a>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <input type="text" className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:border-primary-500"
                onChange={e => trackCustomTextInput(field.label, e.target.value)} />
            )}
          </div>
        ))}

        {needsCustomerPhotos && (
          <div className="mb-5 rounded-2xl border-2 border-dashed border-accent-200 bg-accent-50/30 p-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
              <div>
                <p className="text-sm font-bold text-gray-900">Customer photo areas</p>
                <p className="text-xs text-gray-500 mt-1">
                  {requiredPhotoCount > 0
                    ? `Please upload ${requiredPhotoCount} photo${requiredPhotoCount === 1 ? '' : 's'} for this product.`
                    : `You can upload up to ${maxPhotoCount} photo${maxPhotoCount === 1 ? '' : 's'} for this product.`}
                </p>
              </div>
              <span className="self-start rounded-full bg-white px-3 py-1 text-xs font-bold text-accent-700 border border-accent-100">
                {customerPhotos.length}/{requiredPhotoCount || maxPhotoCount}
              </span>
            </div>
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl bg-white px-4 py-5 text-center transition-colors hover:bg-accent-50 border border-accent-100">
              <FiUpload size={24} className="text-accent-600" />
              <span className="text-sm font-semibold text-gray-800">Upload customer photos</span>
              <span className="text-xs text-gray-500">Upload in the same order as the photo areas shown below</span>
              <input type="file" multiple accept="image/*" className="sr-only" disabled={uploadingCustomerPhotos} onChange={e => handleCustomerPhotoUpload(e.target.files)} />
            </label>
            {uploadingCustomerPhotos && <p className="mt-2 text-xs font-semibold text-accent-700">Uploading photos...</p>}
            {customerPhotos.length > 0 && (
              <div className="mt-4 grid grid-cols-3 sm:grid-cols-4 gap-2">
                {customerPhotos.map((photo, idx) => (
                  <div key={photo.url || idx} className="relative overflow-hidden rounded-xl border bg-white aspect-square">
                    <img src={photo.url} alt={`Uploaded photo ${idx + 1}`} className="h-full w-full object-cover" />
                    <button type="button" onClick={() => setCustomerPhotos(prev => prev.filter((_, i) => i !== idx))} className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-red-500 shadow-sm" aria-label="Remove uploaded photo">
                      <FiX size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Live Customization Preview */}
        {previewEnabled && (
          <div className="mb-5 rounded-2xl border border-primary-100 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="text-sm font-bold text-gray-900">{previewConfig.title || 'Preview your personalized gift'}</p>
                <p className="text-xs text-gray-500 mt-1">Each photo area follows the admin-defined size. Choose portrait or landscape, then crop and align the uploaded image before checkout.</p>
              </div>
            </div>
            {previewConfig.instructions && <p className="text-xs text-primary-700 bg-primary-50 rounded-lg px-3 py-2 mb-3">{previewConfig.instructions}</p>}
            <div className="space-y-4">
              {previewAreas.map((area, idx) => {
                const photo = customerPhotos[idx];
                const adjustments = getAreaAdjustments(idx);
                const shape = area.shape || 'rectangle';
                const areaLabel = area.label || `Photo ${idx + 1}`;
                return (
                  <div key={`${areaLabel}-${idx}`} className="rounded-2xl border bg-gray-50 p-3 sm:p-4">
                    <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-bold text-gray-900">{areaLabel}</p>
                        <p className="text-xs text-gray-500">
                          Size: {area.width || '-'} x {area.height || '-'} {area.unit || 'inch'}{area.required !== false ? ' | Required' : ' | Optional'}
                        </p>
                      </div>
                      {area.instructions && <p className="max-w-sm text-xs text-primary-700 sm:text-right">{area.instructions}</p>}
                    </div>
                    {photo?.url ? (
                      <div className="grid md:grid-cols-2 gap-4 items-start">
                        <div className="rounded-2xl bg-white p-4">
                          <div
                            className="relative mx-auto w-full max-w-sm overflow-hidden bg-white shadow-inner"
                            style={{ aspectRatio: getAreaAspectRatio(area, adjustments.orientation), borderRadius: shape === 'circle' ? '9999px' : shape === 'rounded' ? '24px' : '8px', touchAction: 'none' }} onPointerDown={(e) => startPreviewDrag(idx, e)} onPointerMove={movePreviewDrag} onPointerUp={stopPreviewDrag} onPointerCancel={stopPreviewDrag}
                          >
                            <img
                              src={photo.url}
                              alt={`${areaLabel} preview`}
                              className="absolute inset-0 h-full w-full object-cover"
                              style={{ transform: `translate(${adjustments.x}px, ${adjustments.y}px) scale(${adjustments.zoom})`, transformOrigin: 'center' }}
                            />
                            {area.frameImage && <img src={area.frameImage} alt="Preview frame" className="absolute inset-0 h-full w-full object-cover pointer-events-none" />}
                            <div className="absolute inset-2 border-2 border-white/90 shadow-[0_0_0_999px_rgba(0,0,0,0.08)] pointer-events-none" style={{ borderRadius: shape === 'circle' ? '9999px' : shape === 'rounded' ? '18px' : '6px' }} />
                          </div>
                        </div>
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">Frame direction</label>
                            <div className="grid grid-cols-3 gap-2">
                              {[['auto', 'Admin size'], ['portrait', 'Portrait'], ['landscape', 'Landscape']].map(([value, label]) => (
                                <button key={value} type="button" onClick={() => updateAreaAdjustment(idx, 'orientation', value)} className={`rounded-lg border px-2 py-2 text-xs font-bold ${adjustments.orientation === value ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-gray-200 bg-white text-gray-600'}`}>{label}</button>
                              ))}
                            </div>
                          </div>
                          <p className="rounded-lg bg-white px-3 py-2 text-xs text-gray-500 border">Drag the photo inside the frame, or use the sliders below for exact alignment.</p>
                          <div><label className="block text-xs font-bold text-gray-600 mb-1">Zoom</label><input type="range" min="1" max="3" step="0.05" value={adjustments.zoom} onChange={e => updateAreaAdjustment(idx, 'zoom', Number(e.target.value))} className="w-full" /></div>
                          <div><label className="block text-xs font-bold text-gray-600 mb-1">Move left / right</label><input type="range" min="-160" max="160" value={adjustments.x} onChange={e => updateAreaAdjustment(idx, 'x', Number(e.target.value))} className="w-full" /></div>
                          <div><label className="block text-xs font-bold text-gray-600 mb-1">Move up / down</label><input type="range" min="-160" max="160" value={adjustments.y} onChange={e => updateAreaAdjustment(idx, 'y', Number(e.target.value))} className="w-full" /></div>
                          <button type="button" onClick={() => updateAreaAdjustments(idx, getDefaultPreviewAdjustments())} className="rounded-lg border px-3 py-2 text-sm font-semibold text-gray-700 hover:border-primary-200 hover:text-primary-700">Reset crop</button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 bg-white rounded-xl px-4 py-4">Upload photo {idx + 1} to preview this area.</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {/* Gift Wrap */}
        {product.giftWrap?.enabled && (
          <div className="mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={giftWrap} onChange={e => setGiftWrap(e.target.checked)} className="w-4 h-4" />
              <span className="text-sm">Gift Pack (+{formatPrice(product.giftWrap.price)})</span>
            </label>
          </div>
        )}

        {/* Gift Message */}
        {product.giftMessage && (
          <div className="mb-4">
            <label className="block font-semibold text-sm mb-2">Gift Message</label>
            <textarea className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:border-primary-500" rows={2}
              value={giftMessage} onChange={e => setGiftMessage(e.target.value)} placeholder="Your gift message..." />
          </div>
        )}

        {/* Quantity & Add to Cart */}
        <div className="flex items-center gap-4 mb-5">
          <div className="flex items-center border-2 border-gray-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setQuantity(q => Math.max(1, q - 1))}
              className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 transition-colors text-gray-600">
              <FiMinus size={16} />
            </button>
            <span className="w-12 text-center font-bold text-lg">{quantity}</span>
            <button
              onClick={() => setQuantity(q => Math.min(product.stock || q + 1, q + 1))}
              className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 transition-colors text-gray-600">
              <FiPlus size={16} />
            </button>
          </div>
          <span className="text-sm text-gray-500">{quantity > 1 ? `${quantity} x ${formatPrice(finalUnitPrice)}` : ''}</span>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button onClick={handleAddToCart} disabled={isSoldOut}
            className={`btn-primary flex-1 flex items-center justify-center gap-2 text-center ${isSoldOut ? 'opacity-60 cursor-not-allowed' : ''}`}>
            <FiShoppingCart size={18} />
            {isSoldOut ? 'Sold Out' : product.isQuoteOnly ? 'Contact for Price' : 'Add To Cart'}
          </button>
          {!product.isQuoteOnly && !isSoldOut && (
            <button onClick={handleBuyNow}
              className="btn-accent flex-1 flex items-center justify-center gap-2 text-center">
              <FiZap size={18} />
              Buy It Now
            </button>
          )}
        </div>

        {!product.isQuoteOnly && !isSoldOut && (
          <div className="mt-5 rounded-2xl border border-primary-100 bg-primary-50/50 p-4">
            <p className="text-sm font-bold text-gray-900 mb-3">How to buy this gift</p>
            <div className="grid sm:grid-cols-3 gap-3 text-sm">
              <div className="rounded-xl bg-white p-3 border border-primary-100">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary-600 text-white text-xs font-bold mb-2">1</span>
                <p className="font-semibold text-gray-800">Select options</p>
                <p className="text-xs text-gray-500 mt-1">Choose size, color, upload photo, add custom text, or include gift wrap if available.</p>
              </div>
              <div className="rounded-xl bg-white p-3 border border-primary-100">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-accent-500 text-white text-xs font-bold mb-2">2</span>
                <p className="font-semibold text-gray-800">Checkout</p>
                <p className="text-xs text-gray-500 mt-1">Use Buy It Now for direct checkout or add multiple gifts to cart.</p>
              </div>
              <div className="rounded-xl bg-white p-3 border border-primary-100">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary-600 text-white text-xs font-bold mb-2">3</span>
                <p className="font-semibold text-gray-800">Pay & track</p>
                <p className="text-xs text-gray-500 mt-1">Pay securely online, then track your order from Track Order.</p>
              </div>
            </div>
          </div>
        )}

        {/* Description */}
        {product.description && (
          <div className="mt-8 border-t pt-6">
            <h2 className="text-xl font-bold mb-4">Description</h2>
            <div className="prose prose-sm max-w-none text-gray-600" dangerouslySetInnerHTML={{ __html: product.description }} />
          </div>
        )}

      </div>

      {/* Size Chart Modal */}
      {sizeChartOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setSizeChartOpen(false)}>
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 relative" onClick={e => e.stopPropagation()}>
            <button className="absolute top-4 right-4 text-gray-500 hover:text-gray-800" onClick={() => setSizeChartOpen(false)}><FiX size={20} /></button>
            <h3 className="text-xl font-bold mb-4">Size Chart</h3>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border px-3 py-2 text-left">Size</th>
                  <th className="border px-3 py-2 text-left">Dimensions</th>
                  <th className="border px-3 py-2 text-left">Fits</th>
                </tr>
              </thead>
              <tbody>
                {product.variants?.find(v => v.name.toLowerCase() === 'size')?.options?.map((opt, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="border px-3 py-2 font-medium">{opt.label}</td>
                    <td className="border px-3 py-2 text-gray-600">Standard</td>
                    <td className="border px-3 py-2 text-gray-600">Regular fit</td>
                  </tr>
                )) || (
                  <tr><td colSpan={3} className="border px-3 py-2 text-center text-gray-400">Size information coming soon</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Image Lightbox Modal */}
      {lightboxOpen && product.images?.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setLightboxOpen(false)}>
          <button className="absolute top-4 right-4 text-white hover:text-gray-300 z-50" onClick={() => setLightboxOpen(false)}><FiX size={28} /></button>
          <div className="max-w-4xl max-h-[90vh] relative" onClick={e => e.stopPropagation()} onTouchStart={handleLightboxTouchStart} onTouchMove={handleLightboxTouchMove} onTouchEnd={handleLightboxTouchEnd}>
            <img src={currentMedia?.type === 'image' ? currentMedia.url : imageItems[0]?.url} alt={product.title} className="max-w-full max-h-[85vh] object-contain rounded-lg" onError={(e) => { e.currentTarget.src = '/placeholder.svg'; }} />
            {mediaItems.length > 1 && <button type="button" onClick={goPrevMedia} className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-gray-900 shadow-lg" aria-label="Previous image"><FiChevronLeft size={24} /></button>}
            {mediaItems.length > 1 && <button type="button" onClick={goNextMedia} className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-gray-900 shadow-lg" aria-label="Next image"><FiChevronRight size={24} /></button>}
            {product.images.length > 1 && (
              <div className="flex justify-center gap-2 mt-4">
                {product.images.map((img, idx) => (
                  <button key={idx} onClick={() => setSelectedImage(idx)}
                    className={`w-16 h-16 rounded-lg overflow-hidden border-2 ${idx === selectedImage ? 'border-white' : 'border-transparent opacity-60'}`}>
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}




