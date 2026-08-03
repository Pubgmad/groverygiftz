'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { formatPrice, calcSavings, getEffectivePrice, isOfferActive } from '@/lib/utils';
import { buildProductMetaPayload, trackMetaCustomEvent, trackMetaEvent } from '@/lib/metaPixel';
import { FiMinus, FiPlus, FiX, FiTruck, FiShield, FiClock, FiShoppingCart, FiZap, FiStar, FiUpload, FiImage } from 'react-icons/fi';
import toast from 'react-hot-toast';

function StarRating({ value, onChange }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange?.(star)}
          onMouseEnter={() => onChange && setHover(star)}
          onMouseLeave={() => onChange && setHover(0)}
          className={`text-2xl transition-colors ${
            star <= (hover || value) ? 'text-yellow-400' : 'text-gray-300'
          } ${onChange ? 'cursor-pointer hover:scale-110' : 'cursor-default'}`}
        ><FiStar size={22} className={star <= (hover || value) ? 'fill-yellow-400 stroke-yellow-400' : 'stroke-gray-300'} /></button>
      ))}
    </div>
  );
}

export default function ProductDetail({ product }) {
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selectedVariants, setSelectedVariants] = useState({});
  const [customFieldValues, setCustomFieldValues] = useState({});
  const [customerPhotos, setCustomerPhotos] = useState([]);
  const [uploadingCustomerPhotos, setUploadingCustomerPhotos] = useState(false);
  const [uploadingFields, setUploadingFields] = useState({});
  const [previewSourceField, setPreviewSourceField] = useState('');
  const [previewAdjustments, setPreviewAdjustments] = useState({ zoom: 1, x: 0, y: 0, filter: 'none' });
  const [giftWrap, setGiftWrap] = useState(false);
  const [giftMessage, setGiftMessage] = useState('');
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [sizeChartOpen, setSizeChartOpen] = useState(false);
  const [settings, setSettings] = useState({ freeShippingThreshold: 499, whatsapp: '919994549781' });
  const [reviews, setReviews] = useState([]);
  const [reviewForm, setReviewForm] = useState({ name: '', rating: 0, comment: '' });
  const [submittingReview, setSubmittingReview] = useState(false);
  const { addToCart, setIsCartOpen } = useCart();
  const router = useRouter();
  const viewedProductRef = useRef('');
  const customTextTrackedRef = useRef({});

  const offerActive = isOfferActive(product);
  const savings = offerActive ? calcSavings(product.regularPrice, product.salePrice) : 0;
  const price = getEffectivePrice(product);
  const isSoldOut = Number(product.stock) <= 0;
  const mediaItems = [
    ...(product.images || []).map((url) => ({ type: 'image', url })),
    ...(product.productVideo?.url ? [{ type: 'video', url: product.productVideo.url, name: product.productVideo.name || 'Product video' }] : []),
  ];
  const currentMedia = mediaItems[selectedImage] || mediaItems[0];
  const previewConfig = product.customizationPreview || {};
  const previewEnabled = !!previewConfig.enabled;
  const requiredPhotoCount = Math.max(0, Number(previewConfig.requiredImageCount || 0));
  const maxPhotoCount = Math.max(requiredPhotoCount, Number(previewConfig.maxImageCount || requiredPhotoCount || 0));
  const needsCustomerPhotos = requiredPhotoCount > 0 || maxPhotoCount > 0;
  const uploadedPreviewFile = previewSourceField ? customFieldValues[previewSourceField] : (customerPhotos[0] || null);

  const getOptionExtraPrice = (opt) => Number(opt?.priceAdjustment ?? opt?.price ?? 0);
  const selectedVariantExtra = Object.values(selectedVariants).reduce((sum, selected) => sum + (selected?.extra || 0), 0);
  const finalUnitPrice = price + selectedVariantExtra + (giftWrap && product.giftWrap?.enabled ? Number(product.giftWrap.price || 0) : 0);
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
    for (const variant of product.variants || []) {
      if (!selectedVariants[variant.name]) {
        toast.error(`Please select ${variant.name}`);
        return false;
      }
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
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch(`/api/products/${product.slug}/reviews`)
      .then((r) => r.json())
      .then((d) => setReviews(d.reviews || []))
      .catch(() => {});
  }, [product.slug]);

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
      if (data.type?.startsWith('image/')) setPreviewSourceField(fieldLabel);
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
    const filesToUpload = selectedFiles.slice(0, remainingSlots);
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
  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!reviewForm.name.trim()) return toast.error('Please enter your name');
    if (!reviewForm.rating) return toast.error('Please select a star rating');
    if (!reviewForm.comment.trim()) return toast.error('Please write a review');
    setSubmittingReview(true);
    const res = await fetch(`/api/products/${product.slug}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reviewForm),
    });
    setSubmittingReview(false);
    if (res.ok) {
      const { review } = await res.json();
      setReviews((prev) => [review, ...prev]);
      setReviewForm({ name: '', rating: 0, comment: '' });
      toast.success('Review submitted! Thank you.');
    } else {
      const err = await res.json();
      toast.error(err.error || 'Failed to submit review');
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
    const variantStr = Object.entries(selectedVariants).map(([k, v]) => `${k}: ${v.label}`).join(', ');
    const allCustomFields = customerPhotos.length > 0 ? { ...customFieldValues, 'Customer Photos': customerPhotos } : customFieldValues;

    addToCart({
      productId: product._id,
      title: product.title,
      image: product.images?.[0] || '',
      price: finalUnitPrice,
      quantity,
      variant: variantStr,
      customFields: allCustomFields,
      giftWrap,
      giftMessage,
      customizationPreview: previewEnabled && uploadedPreviewFile?.url ? {
        sourceField: previewSourceField || 'Customer Photos',
        uploadedFile: uploadedPreviewFile,
        adjustments: previewAdjustments,
        previewTitle: previewConfig.title || 'Customization preview',
        frameImage: previewConfig.frameImage || '',
        shape: previewConfig.shape || 'rectangle',
        aspectRatio: previewConfig.aspectRatio || '1:1',
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
        <div className="aspect-square rounded-2xl overflow-hidden bg-gray-100 mb-4 cursor-pointer" onClick={() => currentMedia?.type === 'image' && setLightboxOpen(true)}>
          {currentMedia?.type === 'video' ? (
            <video src={currentMedia.url} controls className="w-full h-full object-cover bg-black" />
          ) : currentMedia?.url ? (
            <img src={currentMedia.url} alt={product.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">No media</div>
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
                  <img src={media.url} alt="" className="w-full h-full object-cover" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Product Info */}
      <div>
        <h1 className="text-2xl md:text-3xl font-display font-bold mb-4">{product.title}</h1>

        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl font-bold text-primary-600">{formatPrice(finalUnitPrice)}</span>
          {savings > 0 && (
            <>
              <span className="text-xl text-gray-400 line-through">{formatPrice(product.regularPrice)}</span>
              <span className="badge-save text-sm">Save {formatPrice(savings)}</span>
            </>
          )}
        </div>

        <div className="bg-primary-50/60 rounded-xl px-4 py-3 mb-6 space-y-2">
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <FiTruck size={14} className="text-primary-600 shrink-0" />
            <span>Tamil Nadu delivery free. Other states calculated at checkout.</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <FiClock size={14} className="text-primary-600 shrink-0" />
            <span>Tamil Nadu: within 8 days. Other states: 10 to 15 days.</span>
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
                const selected = selectedVariants[variant.name]?.label === opt.label;
                return (
                  <button key={oIdx}
                    type="button"
                    disabled={optionSoldOut}
                    onClick={() => setSelectedVariants(prev => ({ ...prev, [variant.name]: { label: opt.label, extra } }))}
                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      selected
                        ? 'border-primary-600 bg-primary-50 text-primary-600'
                        : optionSoldOut
                          ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    {opt.label}
                    {extra > 0 && ` (+${formatPrice(extra)})`}
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
                  <span className="text-xs text-gray-500">JPG, PNG, WEBP, GIF or PDF up to 8 MB</span>
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
                <p className="text-sm font-bold text-gray-900">Required photos</p>
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
              <span className="text-xs text-gray-500">Select clear images for personalization</span>
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
                <p className="text-xs text-gray-500 mt-1">Crop, zoom and filter your uploaded image before checkout. Admin will receive these settings with your order.</p>
              </div>
            </div>
            {previewConfig.instructions && <p className="text-xs text-primary-700 bg-primary-50 rounded-lg px-3 py-2 mb-3">{previewConfig.instructions}</p>}
            {uploadedPreviewFile?.url ? (
              <div className="grid md:grid-cols-2 gap-4 items-start">
                <div className="rounded-2xl bg-gray-100 p-4">
                  <div className="relative mx-auto w-full max-w-sm overflow-hidden bg-white shadow-inner" style={{ aspectRatio: (previewConfig.aspectRatio || '1:1').replace(':', ' / '), borderRadius: previewConfig.shape === 'circle' ? '9999px' : previewConfig.shape === 'rounded' ? '24px' : '8px' }}>
                    <img
                      src={uploadedPreviewFile.url}
                      alt="Customization preview"
                      className="absolute inset-0 h-full w-full object-cover"
                      style={{ transform: 'translate(' + previewAdjustments.x + 'px, ' + previewAdjustments.y + 'px) scale(' + previewAdjustments.zoom + ')', filter: previewAdjustments.filter, transformOrigin: 'center' }}
                    />
                    {previewConfig.frameImage && <img src={previewConfig.frameImage} alt="Preview frame" className="absolute inset-0 h-full w-full object-cover pointer-events-none" />}
                    <div className="absolute inset-3 border border-white/70 pointer-events-none" style={{ borderRadius: previewConfig.shape === 'circle' ? '9999px' : previewConfig.shape === 'rounded' ? '18px' : '6px' }} />
                  </div>
                </div>
                <div className="space-y-3">
                  <div><label className="block text-xs font-bold text-gray-600 mb-1">Zoom</label><input type="range" min="1" max="2.4" step="0.05" value={previewAdjustments.zoom} onChange={e => setPreviewAdjustments(p => ({ ...p, zoom: Number(e.target.value) }))} className="w-full" /></div>
                  <div><label className="block text-xs font-bold text-gray-600 mb-1">Move left / right</label><input type="range" min="-80" max="80" value={previewAdjustments.x} onChange={e => setPreviewAdjustments(p => ({ ...p, x: Number(e.target.value) }))} className="w-full" /></div>
                  <div><label className="block text-xs font-bold text-gray-600 mb-1">Move up / down</label><input type="range" min="-80" max="80" value={previewAdjustments.y} onChange={e => setPreviewAdjustments(p => ({ ...p, y: Number(e.target.value) }))} className="w-full" /></div>
                  <div><label className="block text-xs font-bold text-gray-600 mb-1">Filter</label><select value={previewAdjustments.filter} onChange={e => setPreviewAdjustments(p => ({ ...p, filter: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm"><option value="none">Original</option><option value="grayscale(1)">Black & White</option><option value="sepia(0.55)">Warm</option><option value="contrast(1.15) saturate(1.15)">Vivid</option></select></div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500 bg-gray-50 rounded-xl px-4 py-4">Upload an image in the customization field above to see the live product preview.</p>
            )}
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

        {/* Reviews */}
        <div className="mt-8 border-t pt-6">
          <h2 className="text-xl font-bold mb-1">Customer Reviews</h2>
          {reviews.length > 0 ? (
            <div className="flex items-center gap-2 mb-6">
              <StarRating value={Math.round(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length)} />
              <span className="text-sm text-gray-500">
                {(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)} out of 5 ({reviews.length} review{reviews.length > 1 ? 's' : ''})
              </span>
            </div>
          ) : (
            <p className="text-sm text-gray-400 mb-6">No reviews yet. Be the first to review!</p>
          )}

          {/* Existing reviews list */}
          {reviews.length > 0 && (
            <div className="space-y-4 mb-8">
              {reviews.map((rev) => (
                <div key={rev._id} className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-gray-800 text-sm">{rev.name}</span>
                    <span className="text-xs text-gray-400">{new Date(rev.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                  <StarRating value={rev.rating} />
                  <p className="text-sm text-gray-600 mt-2 leading-relaxed">{rev.comment}</p>
                  {rev.verified && <span className="text-xs text-green-600 mt-1 block">Verified Purchase</span>}
                </div>
              ))}
            </div>
          )}

          {/* Submit review form */}
          <div className="bg-primary-50/50 rounded-xl p-5 border border-primary-100">
            <h3 className="font-semibold mb-4 text-gray-800">Write a Review</h3>
            <form onSubmit={handleSubmitReview} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Your Name *</label>
                <input
                  type="text"
                  value={reviewForm.name}
                  onChange={(e) => setReviewForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:border-primary-500 text-sm"
                  placeholder="John Doe"
                  maxLength={80}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Rating *</label>
                <StarRating value={reviewForm.rating} onChange={(v) => setReviewForm((p) => ({ ...p, rating: v }))} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Review *</label>
                <textarea
                  value={reviewForm.comment}
                  onChange={(e) => setReviewForm((p) => ({ ...p, comment: e.target.value }))}
                  className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:border-primary-500 text-sm"
                  rows={3}
                  placeholder="Share your experience with this product..."
                  maxLength={1000}
                />
              </div>
              <button type="submit" disabled={submittingReview} className="btn-primary py-2 px-6 text-sm">
                {submittingReview ? 'Submitting...' : 'Submit Review'}
              </button>
            </form>
          </div>
        </div>
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
          <div className="max-w-4xl max-h-[90vh] relative" onClick={e => e.stopPropagation()}>
            <img src={product.images[selectedImage]} alt={product.title} className="max-w-full max-h-[85vh] object-contain rounded-lg" />
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




