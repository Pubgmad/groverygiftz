'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { formatPrice, calcSavings, getEffectivePrice, isOfferActive, getVariantRegularPrice, getVariantSalePrice, getVariantEffectivePrice } from '@/lib/utils';
import { getProductAvailableStock, getSelectedAvailableStock, hasVariantManagedStock, isProductSoldOut, isVariantOptionSoldOut } from '@/lib/stock';
import { getCentralDeliveryEstimate, buildCurrentDeliveryEstimate } from '@/lib/centralDeliveryEstimates';
import useDeliverySettings from '@/hooks/useDeliverySettings';
import { buildProductMetaPayload, META_READY_EVENT, trackMetaCustomEvent, trackMetaEvent } from '@/lib/metaPixel';
import { trackGA4Product } from '@/lib/ga4';
import { GOOGLE_CONSENT_SYNC_EVENT } from '@/lib/googleConsent';
import { FiMinus, FiPlus, FiX, FiTruck, FiShield, FiClock, FiShoppingCart, FiZap, FiUpload, FiImage, FiChevronLeft, FiChevronRight, FiStar, FiLoader } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { startNavigationFeedback } from '@/components/layout/NavigationFeedback';
import { appendImageUpload, attachLocalPreview, prepareImageUpload, stableUploadUrl } from '@/lib/clientImageUpload';
import { alignPhotoSlots, clearPhotoSlot, filledPhotoCount, filledPhotos, planPhotoUploads, removeListPhotoByUrl, setPhotoSlot } from '@/lib/photoSlots';
import { adjustmentsForUploadedPhoto, formatFrameSizeLabel, getFrameSize, orientationCaption } from '@/lib/photoEditor';
import PhotoUploadCard from '@/components/product/PhotoUploadCard';
import PhotoAdjuster from '@/components/product/PhotoAdjuster';
import PhotoLimitDialog from '@/components/product/PhotoLimitDialog';
const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand',
  'West Bengal', 'Delhi', 'Jammu & Kashmir', 'Ladakh', 'Puducherry',
];

const isTamilNadu = (state) => String(state || '').trim().toLowerCase() === 'tamil nadu';
const getStateOverride = (delivery, state) => (delivery?.stateOverrides || []).find((row) => String(row.state || '').trim().toLowerCase() === String(state || '').trim().toLowerCase());

// Prefer durable signed displayUrl so the editor never depends on a revoked blob: URL.
const displayUploadUrl = (upload) => stableUploadUrl(upload);
const getDefaultPreviewAdjustments = () => ({ zoom: 1, x: 0, y: 0, orientation: 'auto', rotation: 0, fitMode: 'fit' });

export default function ProductDetail({ product }) {
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selectedVariants, setSelectedVariants] = useState({});
  const [customFieldValues, setCustomFieldValues] = useState({});
  const [customerPhotos, setCustomerPhotos] = useState([]);
  const [variantLabelUploads, setVariantLabelUploads] = useState({});
  const [uploadingVariantLabels, setUploadingVariantLabels] = useState({});
  const [uploadingCustomerPhotos, setUploadingCustomerPhotos] = useState(false);
  const [uploadingPhotoSlots, setUploadingPhotoSlots] = useState({});
  const [editorSlotKey, setEditorSlotKey] = useState(null);
  const [photoLimitPlan, setPhotoLimitPlan] = useState(null);
  const photoUploadTokenRef = useRef({});
  const [activePreviewSlot, setActivePreviewSlot] = useState(0);
  const [collageUploads, setCollageUploads] = useState({});
  const [uploadingCollageLabels, setUploadingCollageLabels] = useState({});
  const [uploadingFields, setUploadingFields] = useState({});
  const [previewAdjustments, setPreviewAdjustments] = useState({});
  const [savedPreviewAreas, setSavedPreviewAreas] = useState({});
  const savedPreviewFilesRef = useRef({});
  const [savingPreviewAreas, setSavingPreviewAreas] = useState({});
  const previewSaveLocksRef = useRef(new Set());
  const [reviews, setReviews] = useState([]);
  const [googleReviews, setGoogleReviews] = useState({ enabled: false, reviews: [], topics: [] });
  const [giftWrap, setGiftWrap] = useState(false);
  const [giftMessage, setGiftMessage] = useState('');
  const [customerNote, setCustomerNote] = useState('');
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [sizeChartOpen, setSizeChartOpen] = useState(false);
  const settings = useDeliverySettings();
  const { addToCart, setIsCartOpen } = useCart();
  const router = useRouter();
  const viewedProductRef = useRef('');
  const customTextTrackedRef = useRef({});
  const actionLockRef = useRef(false);
  const galleryTouchRef = useRef({ startX: 0, endX: 0 });
  const lightboxTouchRef = useRef({ startX: 0, endX: 0 });
  const [selectedDeliveryState, setSelectedDeliveryState] = useState('Tamil Nadu');
  const [actionLoading, setActionLoading] = useState('');
  useEffect(() => {
    setSelectedImage(0);
    setLightboxOpen(false);
    setEditorSlotKey(null);
    setActivePreviewSlot(0);
    setCustomerPhotos([]);
    setVariantLabelUploads({});
    setCollageUploads({});
    setPreviewAdjustments({});
    setSavedPreviewAreas({});
    savedPreviewFilesRef.current = {};
    galleryTouchRef.current = { startX: 0, endX: 0 };
    lightboxTouchRef.current = { startX: 0, endX: 0 };
  }, [product._id, product.slug]);

  const offerActive = isOfferActive(product);
  const isSoldOut = isProductSoldOut(product);
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
  const configuredPreviewAreas = previewEnabled
    ? ((Array.isArray(previewConfig.areas) && previewConfig.areas.length > 0) ? previewConfig.areas : legacyPreviewArea)
    : [];
  const previewAreas = configuredPreviewAreas.filter((area) => area.requiresImageUpload !== false);
  const requiredPhotoCount = Math.max(0, previewAreas.filter((area) => area.required !== false).length || Number(previewConfig.requiredImageCount || 0));
  const maxPhotoCount = Math.max(requiredPhotoCount, previewAreas.length || Number(previewConfig.maxImageCount || requiredPhotoCount || 0));
  const needsCustomerPhotos = requiredPhotoCount > 0 || maxPhotoCount > 0;
  const photoSlotCount = previewAreas.length > 0 ? previewAreas.length : maxPhotoCount;
  const uploadedPhotoCount = filledPhotoCount(customerPhotos);
  useEffect(() => {
    setCustomerPhotos((prev) => alignPhotoSlots(prev, photoSlotCount));
  }, [photoSlotCount]);
  const collageTemplates = product.collageEnabled ? (product.collageTemplates || []).filter((template) => template?.label && template.isActive !== false) : [];
  const needsCollageUploads = collageTemplates.length > 0;
  const getOptionExtraPrice = (opt) => opt?.useOwnPrice ? 0 : Number(opt?.priceAdjustment ?? opt?.price ?? 0);
  const getOptionRegularPrice = getVariantRegularPrice;
  const getOptionSalePrice = getVariantSalePrice;
  const getOptionEffectivePrice = getVariantEffectivePrice;
  const getOptionDisplayPrice = (opt, extra = getOptionExtraPrice(opt)) => {
    const ownRegularPrice = getOptionRegularPrice(opt);
    if (opt?.useOwnPrice && ownRegularPrice > 0) return getOptionEffectivePrice(opt, product);
    return baseDisplayPrice + extra;
  };
  const getOptionComparePrice = (opt, extra = getOptionExtraPrice(opt)) => {
    const ownRegularPrice = getOptionRegularPrice(opt);
    if (opt?.useOwnPrice && ownRegularPrice > 0) return ownRegularPrice;
    return baseRegularPrice + extra;
  };
  useEffect(() => {
    const firstVariantWithOption = (product.variants || [])
      .map((variant) => ({
        variant,
        option: (variant.options || []).find((opt) => opt?.label && !isVariantOptionSoldOut(product, opt)),
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
        requiresImageUpload: !!option.requiresImageUpload,
        previewWidth: option.previewWidth,
        previewHeight: option.previewHeight,
        previewUnit: option.previewUnit || 'inch',
        previewFrameImage: option.previewFrameImage || '',
        previewInstructions: option.previewInstructions || '',
        stock: option.stock,
      },
    });
  }, [product._id, product.variants]);
  const selectedVariantOptions = Object.values(selectedVariants).filter(Boolean);
  const variantManagedStock = hasVariantManagedStock(product);
  const availableStock = getProductAvailableStock(product);
  const selectedAvailableStock = getSelectedAvailableStock(product, selectedVariantOptions);
  const purchaseLimit = Math.max(0, selectedAvailableStock);
  const selectedVariantUploadOptions = selectedVariantOptions.filter((selected) => selected?.requiresImageUpload && selected?.label);
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
  const showContactOnlyPrice = product.isQuoteOnly && !(finalUnitPrice > 0);
  const customerNotesEnabled = product.customerNotesEnabled !== false;
  const price = baseDisplayPrice;
  const productDelivery = product.delivery || {};
  const usesProductDelivery = !!productDelivery.useCustomDelivery;
  const tamilNaduDeliveryCost = usesProductDelivery ? Number(productDelivery.tamilNaduShippingCost || 0) : Number(settings.tamilNaduShippingCost || 0);
  const getSelectedVariantShippingOverride = (state) => selectedVariantOptions
    .flatMap((selected) => selected?.stateOverrides || [])
    .find((row) => String(row.state || '').trim().toLowerCase() === String(state || '').trim().toLowerCase());
  const getProductShippingForState = (state) => {
    if (!state) return { cost: 0, estimate: getCentralDeliveryEstimate(settings, state) };
    const variantOverride = getSelectedVariantShippingOverride(state);
    if (variantOverride?.state) return { cost: Number(variantOverride.shippingCost || 0), estimate: getCentralDeliveryEstimate(settings, state) };
    if (usesProductDelivery) {
      const override = getStateOverride(productDelivery, state);
      if (override?.state) return { cost: Number(override.shippingCost || 0), estimate: getCentralDeliveryEstimate(settings, state) };
      if (isTamilNadu(state)) return { cost: Number(productDelivery.tamilNaduShippingCost || 0), estimate: getCentralDeliveryEstimate(settings, state) };
      return { cost: Number(productDelivery.otherStateShippingCost || 0), estimate: getCentralDeliveryEstimate(settings, state) };
    }
    return isTamilNadu(state)
      ? { cost: Number(settings.tamilNaduShippingCost || 0), estimate: getCentralDeliveryEstimate(settings, state) }
      : { cost: Number(settings.otherStateShippingCost || 0), estimate: getCentralDeliveryEstimate(settings, state) };
  };
  const selectedDelivery = getProductShippingForState(selectedDeliveryState);
  const selectedDeliveryEstimateText = buildCurrentDeliveryEstimate(settings, selectedDeliveryState);
  const productPageTotal = finalUnitPrice * quantity + selectedDelivery.cost;
  const reviewCount = reviews.length;
  const averageRating = reviewCount ? reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviewCount : 0;
  const roundedRating = Math.round(averageRating * 10) / 10;
  const googleReviewsList = Array.isArray(googleReviews?.reviews) ? googleReviews.reviews : [];
  const googleReviewCount = Number(googleReviews?.reviewCount || googleReviewsList.length || 0);
  const googleRating = Number(googleReviews?.rating || 0);
  const visibleGoogleReviews = googleReviews?.enabled ? googleReviewsList.slice(0, 10) : [];
  const googleReviewImages = visibleGoogleReviews.flatMap((review) => Array.isArray(review?.images) ? review.images : []).slice(0, 8);
  const googleReviewTopics = Array.isArray(googleReviews?.topics) ? googleReviews.topics.filter((topic) => topic?.keyword).slice(0, 3) : [];
  const googleBusinessName = googleReviews?.title || 'Grovery giftz - Customized Photo Frames';
  const uploadCardGridClass = 'grid grid-cols-1 gap-2 sm:grid-cols-2';
  const getAreaAdjustments = (idx) => ({ ...getDefaultPreviewAdjustments(), ...(previewAdjustments[idx] || {}) });
  const areaSizeLabel = (area, idx) => formatFrameSizeLabel(area, getAreaAdjustments(idx).orientation);
  const variantAreaFromSelected = (selected) => ({
    label: selected?.label,
    width: selected?.previewWidth || 1,
    height: selected?.previewHeight || 1,
    unit: selected?.previewUnit || 'inch',
    frameImage: selected?.previewFrameImage || '',
    instructions: selected?.previewInstructions || '',
  });
  const loadPreviewImage = (src) => new Promise((resolve, reject) => {
    const image = new Image();
    const timer = setTimeout(() => { image.onload = null; image.onerror = null; reject(new Error('Preview image loading timed out. Please try again.')); }, 30000);
    image.crossOrigin = 'anonymous';
    image.onload = () => { clearTimeout(timer); resolve(image); };
    image.onerror = () => { clearTimeout(timer); reject(new Error('Unable to load the image for preview. Please try uploading it again.')); };
    image.src = src;
  });
  const getContainedDrawRect = (sourceWidth, sourceHeight, boxWidth, boxHeight) => {
    const scale = Math.min(boxWidth / Math.max(1, sourceWidth), boxHeight / Math.max(1, sourceHeight));
    const width = sourceWidth * scale;
    const height = sourceHeight * scale;
    return { x: (boxWidth - width) / 2, y: (boxHeight - height) / 2, width, height };
  };
  const getPreviewDimensions = (area, orientation) => {
    const { width, height } = getFrameSize(area, orientation);
    const displayWidth = 720;
    return { displayWidth, displayHeight: displayWidth * (height / width) };
  };
  const renderFinalPreviewImage = async (area, idx, sourceUrl = '', overrideAdjustments) => {
    const photo = sourceUrl ? (typeof sourceUrl === 'object' ? sourceUrl : { url: sourceUrl }) : customerPhotos[idx];
    const photoUrl = displayUploadUrl(photo);
    if (!photoUrl) return '';
    try {
      const adjustments = overrideAdjustments ? { ...getDefaultPreviewAdjustments(), ...overrideAdjustments } : getAreaAdjustments(idx);
      const { displayWidth, displayHeight } = getPreviewDimensions(area, adjustments.orientation);
      const scale = 2;
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(320, Math.round(displayWidth * scale));
      canvas.height = Math.max(240, Math.round(displayHeight * scale));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      let uploadedImage;
      try {
        uploadedImage = await loadPreviewImage(photoUrl);
      } catch (error) {
        if (!photo.displayUrl || photo.displayUrl === photoUrl) throw error;
        uploadedImage = await loadPreviewImage(photo.displayUrl);
      }
      const srcW = uploadedImage.naturalWidth || uploadedImage.width;
      const srcH = uploadedImage.naturalHeight || uploadedImage.height;
      const rotation = ((Number(adjustments.rotation || 0) % 360) + 360) % 360;
      const rad = rotation * Math.PI / 180;
      const boundW = Math.abs(Math.cos(rad)) * srcW + Math.abs(Math.sin(rad)) * srcH;
      const boundH = Math.abs(Math.sin(rad)) * srcW + Math.abs(Math.cos(rad)) * srcH;
      const imageRect = getContainedDrawRect(boundW, boundH, canvas.width, canvas.height);
      const zoom = Math.max(0.1, Number(adjustments.zoom || 1));
      const scaleToBound = (imageRect.width * zoom) / Math.max(1, boundW);
      const drawW = srcW * scaleToBound;
      const drawH = srcH * scaleToBound;
      const centerX = canvas.width / 2 + (Number(adjustments.x || 0) * scale);
      const centerY = canvas.height / 2 + (Number(adjustments.y || 0) * scale);
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(rad);
      ctx.drawImage(uploadedImage, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();

      if (area.frameImage) {
        try {
          const frameImage = await loadPreviewImage(area.frameImage);
          const frameRect = getContainedDrawRect(
            frameImage.naturalWidth || frameImage.width,
            frameImage.naturalHeight || frameImage.height,
            canvas.width,
            canvas.height
          );
          ctx.drawImage(frameImage, frameRect.x, frameRect.y, frameRect.width, frameRect.height);
        } catch (error) {
          // The uploaded customer image is still enough for production if an external frame cannot be rendered.
        }
      }

      return canvas.toDataURL('image/jpeg', 0.9);
    } catch (error) {
      throw new Error(error.message || 'Unable to generate the customized preview. Please try again.');
    }
  };
  const uploadRenderedPreviewImage = async (dataUrl, label, idx) => {
    if (!dataUrl) throw new Error('The customized preview is empty. Please try saving it again.');
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const safeLabel = String(label || `photo-${idx + 1}`).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `photo-${idx + 1}`;
      const formData = new FormData();
      formData.append('file', new File([blob], `${safeLabel}-final-preview.jpg`, { type: 'image/jpeg' }));
      const res = await fetch('/api/customization-upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Preview upload failed');
      return { ...data, previewUrl: dataUrl };
    } catch (error) {
      throw new Error(error.message || 'Unable to store the customized preview. Please try again.');
    }
  };
  const buildCustomizationPreviewPayload = async () => {
    const previews = [];

    if (previewEnabled) {
      for (let idx = 0; idx < previewAreas.length; idx += 1) {
        const area = previewAreas[idx];
        const uploadedFile = customerPhotos[idx] || null;
        if (!uploadedFile?.url) continue;
        const areaLabel = area.label || ('Photo ' + (idx + 1));
        const saved = savedPreviewFilesRef.current[idx];
        const cached = saved?.sourceUrl === uploadedFile.url && saved?.adjustments === JSON.stringify(getAreaAdjustments(idx)) ? saved.file : null;
        const finalPreviewDataUrl = cached ? '' : await renderFinalPreviewImage(area, idx, uploadedFile);
        const finalPreviewImage = cached || await uploadRenderedPreviewImage(finalPreviewDataUrl, areaLabel, idx);
        const adjustments = getAreaAdjustments(idx);
        const oriented = getFrameSize(area, adjustments.orientation);
        previews.push({
          areaLabel,
          width: oriented.width,
          height: oriented.height,
          configuredWidth: area.width || '',
          configuredHeight: area.height || '',
          unit: area.unit || 'inch',
          instructions: area.instructions || '',
          frameImage: area.frameImage || '',
          uploadedFile,
          adjustments,
          finalPreviewImage,
          finalPreviewDataUrl: finalPreviewImage?.url ? '' : finalPreviewDataUrl,
        });
      }
    }

    for (const selected of selectedVariantUploadOptions) {
      const uploadedFile = variantLabelUploads[selected.label] || null;
      if (!uploadedFile?.url) continue;
      const previewKey = `variant-${selected.label}`;
      const area = {
        label: selected.label,
        width: selected.previewWidth || 1,
        height: selected.previewHeight || 1,
        unit: selected.previewUnit || 'inch',
        frameImage: selected.previewFrameImage || '',
        instructions: selected.previewInstructions || '',
      };
      const areaLabel = `Variant: ${selected.label}`;
      const saved = savedPreviewFilesRef.current[previewKey];
      const cached = saved?.sourceUrl === uploadedFile.url && saved?.adjustments === JSON.stringify(getAreaAdjustments(previewKey)) ? saved.file : null;
      const finalPreviewDataUrl = cached ? '' : await renderFinalPreviewImage(area, previewKey, uploadedFile);
      const finalPreviewImage = cached || await uploadRenderedPreviewImage(finalPreviewDataUrl, areaLabel, previews.length);
      const adjustments = getAreaAdjustments(previewKey);
      const oriented = getFrameSize(area, adjustments.orientation);
      previews.push({
        areaLabel,
        width: oriented.width,
        height: oriented.height,
        configuredWidth: area.width || '',
        configuredHeight: area.height || '',
        unit: area.unit || 'inch',
        instructions: area.instructions || '',
        frameImage: area.frameImage || '',
        uploadedFile,
        adjustments,
        finalPreviewImage,
        finalPreviewDataUrl: finalPreviewImage?.url ? '' : finalPreviewDataUrl,
        sourceType: 'variant',
      });
    }

    if (previews.length === 0) return null;
    return { previewTitle: previewConfig.title || 'Customization preview', previews };
  };
  const savePreviewArea = async (idx, overrideAdjustments) => {
    if (previewSaveLocksRef.current.has(idx) || actionLockRef.current) return false;
    previewSaveLocksRef.current.add(idx);
    setSavingPreviewAreas((prev) => ({ ...prev, [idx]: true }));
    try {
      const variant = typeof idx === 'string' ? selectedVariantUploadOptions.find((option) => `variant-${option.label}` === idx) : null;
      const area = variant ? { label: variant.label, width: variant.previewWidth || 1, height: variant.previewHeight || 1, unit: variant.previewUnit || 'inch', frameImage: variant.previewFrameImage || '' } : previewAreas[idx] || { label: `Photo ${Number(idx) + 1}`, width: 1, height: 1, unit: 'ratio' };
      const upload = variant ? variantLabelUploads[variant.label] : customerPhotos[idx];
      if (!upload?.url) throw new Error('Please upload an image before saving its preview.');
      const adjustmentsObj = overrideAdjustments ? { ...getDefaultPreviewAdjustments(), ...overrideAdjustments } : getAreaAdjustments(idx);
      setPreviewAdjustments((prev) => ({ ...prev, [idx]: adjustmentsObj }));
      if (previewEnabled || variant) {
        const rendered = await renderFinalPreviewImage(area, idx, upload, adjustmentsObj);
      const file = await uploadRenderedPreviewImage(rendered, area.label, idx);
        savedPreviewFilesRef.current[idx] = { file, sourceUrl: upload.url, adjustments: JSON.stringify(adjustmentsObj) };
      }
      setSavedPreviewAreas((prev) => ({ ...prev, [idx]: true }));
      toast.success('Photo updated for this frame');
      return true;
    } catch (error) {
      toast.error(error.message || 'Unable to save preview. Please try again.');
      return false;
    } finally {
      previewSaveLocksRef.current.delete(idx);
      setSavingPreviewAreas((prev) => ({ ...prev, [idx]: false }));
    }
  };
  const editPreviewArea = (idx) => { if (previewSaveLocksRef.current.has(idx)) return; delete savedPreviewFilesRef.current[idx]; setSavedPreviewAreas((prev) => ({ ...prev, [idx]: false })); };
  const getProductPixelPayload = (extra = {}) => buildProductMetaPayload(product, {
    price: finalUnitPrice,
    quantity,
    value: finalUnitPrice * quantity,
    ...extra,
  });

  useEffect(() => {
    const track = () => {
      if (viewedProductRef.current === product._id) return;
      if (trackMetaEvent('ViewContent', buildProductMetaPayload(product, { price, value: price }))) viewedProductRef.current = product._id;
    };
    track();
    window.addEventListener(META_READY_EVENT, track);
    return () => window.removeEventListener(META_READY_EVENT, track);
  }, [price, product]);

  const ga4Variant = Object.entries(selectedVariants).filter(([, option]) => option?.label).map(([name, option]) => `${name}: ${option.label}`).join(', ');
  useEffect(() => {
    const track = () => trackGA4Product('view_item', product, { price: baseDisplayPrice + selectedVariantExtra, variant: ga4Variant, quantity: 1 });
    track();
    window.addEventListener(GOOGLE_CONSENT_SYNC_EVENT, track);
    return () => window.removeEventListener(GOOGLE_CONSENT_SYNC_EVENT, track);
  }, [product, baseDisplayPrice, selectedVariantExtra, ga4Variant]);

  useEffect(() => {
    fetch(`/api/products/${product.slug || product._id}/reviews`)
      .then((r) => r.json())
      .then((d) => setReviews(Array.isArray(d.reviews) ? d.reviews : []))
      .catch(() => setReviews([]));
    fetch('/api/google-reviews')
      .then((r) => r.json())
      .then((d) => setGoogleReviews(d || { enabled: false, reviews: [], topics: [] }))
      .catch(() => setGoogleReviews({ enabled: false, reviews: [], topics: [] }));
  }, [product.slug, product._id]);

  const trackCustomTextInput = (fieldLabel, value) => {
    setCustomFieldValues((prev) => ({ ...prev, [fieldLabel]: value }));
    if (!String(value || '').trim() || customTextTrackedRef.current[fieldLabel]) return;
    customTextTrackedRef.current[fieldLabel] = true;
    trackMetaCustomEvent('CustomizeProduct', getProductPixelPayload({ customization_type: 'text', field_label: fieldLabel }));
  };

  const validateSelections = () => {
    if ((product.variants || []).length > 0 && selectedVariantOptions.length === 0) {
      toast.error('Please select one variant option');
      return false;
    }
    if (!product.isQuoteOnly && selectedAvailableStock <= 0) {
      toast.error('Selected option is sold out');
      return false;
    }
    if (!product.isQuoteOnly && quantity > selectedAvailableStock) {
      toast.error(`Only ${selectedAvailableStock} item${selectedAvailableStock === 1 ? '' : 's'} available`);
      return false;
    }
    for (const field of product.customFields || []) {
      if (field.required && !customFieldValues[field.label]) {
        toast.error(`Please fill required field: ${field.label}`);
        return false;
      }
    }
    if (needsCustomerPhotos) {
      const alignedPhotos = alignPhotoSlots(customerPhotos, photoSlotCount);
      for (let idx = 0; idx < photoSlotCount; idx += 1) {
        const slotRequired = previewAreas[idx] ? previewAreas[idx].required !== false : idx < requiredPhotoCount;
        if (slotRequired && !alignedPhotos[idx]?.url) {
          const label = previewAreas[idx]?.label || `Photo ${idx + 1}`;
          toast.error(`Please upload a photo for "${label}"`);
          return false;
        }
      }
      if (uploadedPhotoCount < requiredPhotoCount) {
        toast.error(`Please upload at least ${requiredPhotoCount} customer photo${requiredPhotoCount === 1 ? '' : 's'} for this product`);
        return false;
      }
      if (maxPhotoCount > 0 && uploadedPhotoCount > maxPhotoCount) {
        toast.error(`Please upload no more than ${maxPhotoCount} photo${maxPhotoCount === 1 ? '' : 's'}`);
        return false;
      }
    }
    for (const selected of selectedVariantUploadOptions) {
      if (!variantLabelUploads[selected.label]?.url) {
        toast.error(`Please upload image for ${selected.label}`);
        return false;
      }
    }
    for (const template of collageTemplates) {
      const photos = collageUploads[template.label] || [];
      const min = Math.max(0, Number(template.minImages || 0));
      const max = Math.max(min, Number(template.maxImages || min || 0));
      if (photos.length < min || photos.length > max) {
        toast.error(`${template.label}: upload between ${min} and ${max} images`);
        return false;
      }
    }
    return true;
  };

  useEffect(() => {
    const savedState = window.localStorage?.getItem('groveryDeliveryState');
    if (savedState) setSelectedDeliveryState(savedState);
  }, []);

  useEffect(() => {
    if (selectedDeliveryState) window.localStorage?.setItem('groveryDeliveryState', selectedDeliveryState);
  }, [selectedDeliveryState]);

  const handleCustomizationFileUpload = async (fieldLabel, file) => {
    if (!file) return;
    setUploadingFields((prev) => ({ ...prev, [fieldLabel]: true }));
    try {
      const prepared = await prepareImageUpload(file);
      const formData = new FormData();
      appendImageUpload(formData, file, prepared);
      const res = await fetch('/api/customization-upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      const uploadedFile = attachLocalPreview(data, prepared);
      setCustomFieldValues((prev) => ({ ...prev, [fieldLabel]: uploadedFile }));
      toast.success('Customization file uploaded');
      trackMetaCustomEvent('CustomizeProduct', getProductPixelPayload({ customization_type: 'file_upload', field_label: fieldLabel, file_type: data.type || file.type || '' }));
    } catch (error) {
      toast.error(error.message || 'Failed to upload file');
    } finally {
      setUploadingFields((prev) => ({ ...prev, [fieldLabel]: false }));
    }
  };
  const handleCustomerPhotoUpload = async (files, slotIndex = null) => {
    const selectedFiles = Array.from(files || []);
    if (selectedFiles.length === 0) return;
    const plan = planPhotoUploads(customerPhotos, selectedFiles, slotIndex, photoSlotCount);
    if (plan.blocked) {
      setPhotoLimitPlan(plan);
      return;
    }
    const jobs = plan.jobs;
    if (jobs.length === 0) return;
    const openEditor = selectedFiles.length === 1 && jobs.length === 1;
    setUploadingCustomerPhotos(true);
    try {
      for (const job of jobs) {
        const token = (photoUploadTokenRef.current[job.index] || 0) + 1;
        photoUploadTokenRef.current[job.index] = token;
        setUploadingPhotoSlots((prev) => ({ ...prev, [job.index]: true }));
        const prepared = await prepareImageUpload(job.file);
        const formData = new FormData();
        appendImageUpload(formData, job.file, prepared);
        const res = await fetch('/api/customization-upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Failed to upload ${job.file.name}`);
        if (photoUploadTokenRef.current[job.index] !== token) continue;
        const uploadedFile = attachLocalPreview(data, prepared);
        const area = previewAreas[job.index] || null;
        const adjustments = adjustmentsForUploadedPhoto(prepared.width, prepared.height, area);
        setActivePreviewSlot(job.index);
        editPreviewArea(job.index);
        setPreviewAdjustments((prev) => ({ ...prev, [job.index]: adjustments }));
        setCustomerPhotos((prev) => setPhotoSlot(alignPhotoSlots(prev, photoSlotCount), job.index, uploadedFile));
        setUploadingPhotoSlots((prev) => ({ ...prev, [job.index]: false }));
        if (openEditor) setEditorSlotKey(job.index);
      }
      toast.success(jobs.length === 1 ? 'Photo uploaded' : `${jobs.length} photos uploaded`);
      trackMetaCustomEvent('CustomizeProduct', getProductPixelPayload({ customization_type: 'customer_photos', photo_count: jobs.length }));
    } catch (error) {
      toast.error(error.message || 'Failed to upload photos');
      setUploadingPhotoSlots((prev) => {
        const next = { ...prev };
        jobs.forEach((job) => { next[job.index] = false; });
        return next;
      });
    } finally {
      setUploadingCustomerPhotos(false);
    }
  };

  const removeCustomerPhoto = (slotIndex) => {
    setCustomerPhotos((prev) => {
      const previewUrl = prev[slotIndex]?.previewUrl;
      if (typeof previewUrl === 'string' && previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
      return clearPhotoSlot(prev, slotIndex);
    });
    setActivePreviewSlot(slotIndex);
    if (editorSlotKey === slotIndex) setEditorSlotKey(null);
    delete savedPreviewFilesRef.current[slotIndex];
    setSavedPreviewAreas((prev) => ({ ...prev, [slotIndex]: false }));
    setPreviewAdjustments((prev) => ({ ...prev, [slotIndex]: getDefaultPreviewAdjustments() }));
  };


  const handleVariantLabelUpload = async (label, file) => {
    if (!label || !file) return;
    setUploadingVariantLabels((prev) => ({ ...prev, [label]: true }));
    try {
      const prepared = await prepareImageUpload(file);
      const formData = new FormData();
      appendImageUpload(formData, file, prepared);
      const res = await fetch('/api/customization-upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      const uploadedFile = attachLocalPreview(data, prepared);
      editPreviewArea(`variant-${label}`);
      const variantArea = selectedVariantUploadOptions.find((entry) => entry.label === label)
        || { label, width: 1, height: 1, unit: 'inch' };
      const variantFrame = {
        label: variantArea.label || label,
        width: Number(variantArea.previewWidth || variantArea.width || 1),
        height: Number(variantArea.previewHeight || variantArea.height || 1),
        unit: variantArea.previewUnit || variantArea.unit || 'inch',
      };
      setPreviewAdjustments((prev) => ({ ...prev, [`variant-${label}`]: adjustmentsForUploadedPhoto(prepared.width, prepared.height, variantFrame) }));
      setVariantLabelUploads((prev) => ({ ...prev, [label]: { ...uploadedFile, label } }));
      setEditorSlotKey(`variant-${label}`);
      toast.success(`${label} image uploaded`);
      trackMetaCustomEvent('CustomizeProduct', getProductPixelPayload({ customization_type: 'variant_label_upload', field_label: label, file_type: data.type || file.type || '' }));
    } catch (error) {
      toast.error(error.message || 'Failed to upload image');
    } finally {
      setUploadingVariantLabels((prev) => ({ ...prev, [label]: false }));
    }
  };
  const handleCollageUpload = async (label, files) => {
    const template = collageTemplates.find((entry) => entry.label === label);
    const selectedFiles = Array.from(files || []);
    if (!template || selectedFiles.length === 0) return;
    const current = collageUploads[label] || [];
    const min = Math.max(0, Number(template.minImages || 0));
    const max = Math.max(min, Number(template.maxImages || min || 0));
    const remainingSlots = max - current.length;
    if (remainingSlots <= 0) {
      toast.error(`${label}: maximum ${max} images allowed`);
      return;
    }
    if (selectedFiles.length > remainingSlots) {
      toast.error(`${label}: you can add only ${remainingSlots} more image${remainingSlots === 1 ? '' : 's'}`);
      return;
    }
    setUploadingCollageLabels((prev) => ({ ...prev, [label]: true }));
    try {
      const uploaded = [];
      for (const file of selectedFiles) {
        const prepared = await prepareImageUpload(file);
        const formData = new FormData();
        appendImageUpload(formData, file, prepared);
        const res = await fetch('/api/customization-upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Failed to upload ${file.name}`);
        const uploadedFile = attachLocalPreview(data, prepared);
        uploaded.push(uploadedFile);
        setCollageUploads((prev) => ({ ...prev, [label]: [...(prev[label] || []), uploadedFile] }));
      }
      toast.success(`${label}: ${uploaded.length} image${uploaded.length === 1 ? '' : 's'} uploaded`);
      trackMetaCustomEvent('CustomizeProduct', getProductPixelPayload({ customization_type: 'collage_upload', collage_label: label, photo_count: uploaded.length }));
    } catch (error) {
      toast.error(error.message || `${label}: failed to upload images`);
    } finally {
      setUploadingCollageLabels((prev) => ({ ...prev, [label]: false }));
    }
  };

  const handleCollageReplace = async (label, index, file) => {
    if (!label || !file || index < 0) return;
    setUploadingCollageLabels((prev) => ({ ...prev, [label]: true }));
    try {
      const prepared = await prepareImageUpload(file);
      const formData = new FormData();
      appendImageUpload(formData, file, prepared);
      const res = await fetch('/api/customization-upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to upload ${file.name}`);
      const uploadedFile = attachLocalPreview(data, prepared);
      setCollageUploads((prev) => {
        const current = [...(prev[label] || [])];
        if (index >= current.length) return prev;
        current[index] = uploadedFile;
        return { ...prev, [label]: current };
      });
      toast.success(`${label}: photo replaced`);
    } catch (error) {
      toast.error(error.message || `${label}: failed to replace image`);
    } finally {
      setUploadingCollageLabels((prev) => ({ ...prev, [label]: false }));
    }
  };
  const removeCollagePhoto = (label, url) => setCollageUploads((prev) => ({
    ...prev,
    [label]: removeListPhotoByUrl(prev[label] || [], url),
  }));
  const removeVariantLabelUpload = (label) => {
    setVariantLabelUploads((prev) => {
      const next = { ...prev };
      delete next[label];
      return next;
    });
    editPreviewArea(`variant-${label}`);
    if (editorSlotKey === `variant-${label}`) setEditorSlotKey(null);
  };
  const addConfiguredProductToCart = async ({ openCart = true } = {}) => {
    if (uploadingCustomerPhotos || Object.values(uploadingFields).some(Boolean) || Object.values(uploadingVariantLabels).some(Boolean) || Object.values(uploadingCollageLabels).some(Boolean) || previewSaveLocksRef.current.size > 0) {
      toast.error('Please wait for your images and previews to finish saving.');
      return false;
    }
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
    const collageGroups = collageTemplates.map((template) => ({
      label: template.label,
      minImages: Number(template.minImages || 0),
      maxImages: Number(template.maxImages || template.minImages || 0),
      images: collageUploads[template.label] || [],
    })).filter((group) => group.images.length > 0);
    const variantUploads = Object.fromEntries(Object.entries(variantLabelUploads).filter(([, value]) => value?.url));
    const productCustomerNote = customerNotesEnabled ? customerNote.trim() : '';
    const uploadedCustomerPhotos = filledPhotos(customerPhotos);
    const allCustomFields = { ...customFieldValues, ...(productCustomerNote ? { 'Customer Note': productCustomerNote } : {}), ...(uploadedCustomerPhotos.length > 0 ? { 'Customer Photos': uploadedCustomerPhotos } : {}), ...(Object.keys(variantUploads).length > 0 ? { 'Variant Label Uploads': variantUploads } : {}) };

    const customizationPreviewPayload = await buildCustomizationPreviewPayload();
    const hasConfiguredAssets = Object.keys(allCustomFields).length > 0 || collageGroups.length > 0 || Boolean(customizationPreviewPayload) || giftWrap || Boolean(giftMessage.trim());

    const addedQuantity = addToCart({
      productId: product._id,
      cartItemId: hasConfiguredAssets ? `${product._id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` : undefined,
      title: product.title,
      image: product.images?.[0] || '',
      images: product.images || [],
      price: finalUnitPrice,
      quantity,
      availableStock: selectedAvailableStock,
      variant: variantStr,
      customFields: allCustomFields,
      customerNotesEnabled,
      collageUploads: collageGroups,
      giftWrap,
      giftMessage,
      delivery: product.delivery || null,
      variantDelivery: { stateOverrides: selectedVariantOptions.flatMap((selected) => selected?.stateOverrides || []) },
      deliveryState: selectedDeliveryState,
      customizationPreview: customizationPreviewPayload,
    }, { openDrawer: openCart });
    if (addedQuantity > 0) trackMetaEvent('AddToCart', getProductPixelPayload({ quantity: addedQuantity, value: finalUnitPrice * addedQuantity }));
    if (Object.keys(allCustomFields || {}).length > 0 || giftWrap || giftMessage.trim()) {
      trackMetaCustomEvent('CustomizeProduct', getProductPixelPayload({ customization_type: 'configured_product' }));
    }
    return true;
  };

  const handleAddToCart = async () => {
    if (actionLockRef.current) return;
    actionLockRef.current = true;
    setActionLoading('cart');
    try {
      if (await addConfiguredProductToCart({ openCart: true })) toast.success('Added to cart!');
    } catch (error) {
      toast.error(error.message || 'Unable to save your preview. Your uploaded images are still available.');
    } finally {
      actionLockRef.current = false;
      setActionLoading('');
    }
  };

  const handleBuyNow = async () => {
    if (actionLockRef.current) return;
    actionLockRef.current = true;
    setActionLoading('buy');
    try {
      if (!(await addConfiguredProductToCart({ openCart: false }))) return;
      setIsCartOpen(false);
      toast.success('Taking you to checkout...');
      startNavigationFeedback();
      router.push('/checkout');
    } catch (error) {
      toast.error(error.message || 'Unable to save your preview. Your uploaded images are still available.');
    } finally {
      actionLockRef.current = false;
      setActionLoading('');
    }
  };
  const editorIsVariant = typeof editorSlotKey === 'string' && String(editorSlotKey).startsWith('variant-');
  const editorVariantLabel = editorIsVariant ? String(editorSlotKey).slice('variant-'.length) : '';
  const editorVariant = editorIsVariant ? selectedVariantUploadOptions.find((option) => option.label === editorVariantLabel) : null;
  const editorArea = editorIsVariant
    ? { label: editorVariant?.label, width: editorVariant?.previewWidth || 1, height: editorVariant?.previewHeight || 1, unit: editorVariant?.previewUnit || 'inch', frameImage: editorVariant?.previewFrameImage || '' }
    : (Number.isInteger(editorSlotKey) ? (previewAreas[editorSlotKey] || { label: `Photo ${editorSlotKey + 1}`, width: 1, height: 1, unit: 'ratio' }) : null);
  const editorPhoto = editorIsVariant ? variantLabelUploads[editorVariantLabel] : (Number.isInteger(editorSlotKey) ? customerPhotos[editorSlotKey] : null);
  const editorPhotoUrl = displayUploadUrl(editorPhoto);
  const selectedVariantLabel = selectedVariantOptions.find((option) => option?.label)?.label || '';

  return (
    <div className="product-mobile-safe grid max-w-full grid-cols-1 gap-8 md:grid-cols-2 md:gap-12">
      {/* Product Media Gallery */}
      <div>
        <div className="relative rounded-2xl overflow-hidden bg-white mb-4 cursor-pointer" onClick={() => currentMedia?.type === 'image' && setLightboxOpen(true)} onTouchStart={handleGalleryTouchStart} onTouchMove={handleGalleryTouchMove} onTouchEnd={handleGalleryTouchEnd}>
          {currentMedia?.type === 'video' ? (
            <video src={currentMedia.url} controls className="w-full max-h-[70vh] object-contain bg-black" />
          ) : currentMedia?.url ? (
            <img key={currentMedia.type + ':' + currentMedia.url} src={currentMedia.url} alt={product.title} className="mx-auto block h-auto max-h-[78vh] max-w-full object-contain bg-white" onError={(e) => { e.currentTarget.src = '/placeholder.svg'; }} />
          ) : (
            <div className="flex min-h-[320px] w-full items-center justify-center text-gray-400">No media</div>
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
              <button key={media.type + ':' + media.url + '-' + idx} onClick={() => setSelectedImage(idx)}
                className={"relative w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 border-2 bg-gray-100 " + (idx === selectedImage ? 'border-primary-600' : 'border-transparent')}>
                {media.type === 'video' ? (
                  <div className="w-full h-full flex items-center justify-center bg-gray-900 text-white text-xs font-bold">Video</div>
                ) : (
                  <img src={media.url} alt="" className="h-full w-full object-contain bg-white" onError={(e) => { e.currentTarget.src = '/placeholder.svg'; }} />
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
          <span className="text-3xl font-bold text-primary-600">{showContactOnlyPrice ? 'Contact for Price' : formatPrice(finalUnitPrice)}</span>
          {!showContactOnlyPrice && savings > 0 && (
            <>
              <span className="text-xl text-gray-400 line-through">{formatPrice(compareAtPrice)}</span>
              <span className="badge-save text-sm">Save {formatPrice(savings)}</span>
              {!selectedOwnPriceOption && baseOfferActive && product.offerEndsAt && <span className="inline-flex items-center gap-1 rounded-full bg-accent-50 px-3 py-1 text-xs font-extrabold text-accent-700"><FiClock size={12} /> Offer ends {new Date(product.offerEndsAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
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
                  <p className="text-xs text-gray-500">Estimated delivery: <span className="font-semibold text-gray-800">{selectedDeliveryEstimateText}</span></p>
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
            <span>{getCentralDeliveryEstimate(settings, 'Tamil Nadu') && getCentralDeliveryEstimate(settings, 'Karnataka')
              ? `Tamil Nadu Delivery: ${getCentralDeliveryEstimate(settings, 'Tamil Nadu')} | Other States: ${getCentralDeliveryEstimate(settings, 'Karnataka')}`
              : selectedDeliveryEstimateText}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <FiShield size={14} className="text-primary-600 shrink-0" />
            <span>100% Safe & Secure Payments</span>
          </div>
          {isSoldOut ? (
            <p className="text-red-600 font-semibold text-sm">Out of stock</p>
          ) : variantManagedStock ? (
            <p className="text-gray-600 text-sm">{availableStock} in stock across variants</p>
          ) : Number(product.stock) > 0 && Number(product.stock) <= 15 ? (
            <p className="text-amber-800 font-semibold text-sm flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center rounded-md bg-amber-100 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-amber-900">
                Almost gone
              </span>
              Only {product.stock} in stock - order soon!
            </p>
          ) : Number(product.stock) > 0 && Number(product.stock) <= 40 ? (
            <p className="text-amber-700 text-sm font-medium">
              {product.stock} in stock - selling fast
            </p>
          ) : Number(product.stock) > 0 ? (
            <p className="text-gray-600 text-sm">{product.stock} in stock</p>
          ) : null}
        </div>

        {/* Variants */}
        {product.variants?.map((variant, vIdx) => (
          <div key={vIdx} className="mb-6">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-base font-extrabold text-gray-950">Select {variant.name}</p>
                {selectedVariants[variant.name]?.label && <p className="mt-0.5 text-xs font-semibold text-gray-500">Selected: {selectedVariants[variant.name].label}</p>}
              </div>
              {variant.name.toLowerCase() === 'size' && (
                <button type="button" onClick={() => setSizeChartOpen(true)} className="rounded-full border border-primary-200 px-3 py-1 text-xs font-bold text-primary-700 hover:bg-primary-50">
                  Size Chart
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
              {variant.options?.map((opt, oIdx) => {
                const extra = getOptionExtraPrice(opt);
                const optionSoldOut = isVariantOptionSoldOut(product, opt);
                const displayOptionPrice = getOptionDisplayPrice(opt, extra);
                const compareOptionPrice = getOptionComparePrice(opt, extra);
                const selected = selectedVariants[variant.name]?.label === opt.label;
                return (
                  <button key={oIdx}
                    type="button"
                    disabled={optionSoldOut}
                    onClick={() => setSelectedVariants(prev => { const selectedNow = prev[variant.name]?.label === opt.label; if (selectedNow) return {}; return { [variant.name]: { label: opt.label, extra, useOwnPrice: !!opt.useOwnPrice, regularPrice: opt.regularPrice, salePrice: opt.salePrice, stateOverrides: opt.stateOverrides || [], requiresImageUpload: !!opt.requiresImageUpload, previewWidth: opt.previewWidth, previewHeight: opt.previewHeight, previewUnit: opt.previewUnit || 'inch', previewFrameImage: opt.previewFrameImage || '', previewInstructions: opt.previewInstructions || '', stock: opt.stock } }; })}
                    className={`group relative flex min-h-[118px] flex-col items-center justify-center rounded-2xl border-2 bg-white px-2.5 py-4 text-center shadow-sm transition-all duration-200 sm:min-h-[132px] sm:px-3 ${
                      selected
                        ? 'border-accent-600 bg-accent-50/30 shadow-orange'
                        : optionSoldOut
                          ? 'cursor-not-allowed border-gray-200 bg-gray-50 opacity-60'
                          : 'border-primary-100 hover:-translate-y-0.5 hover:border-accent-300 hover:shadow-md'
                    }`}
                  >
                    <span className={`mb-2 inline-flex max-w-full items-center justify-center rounded-lg px-2.5 py-1 text-lg font-extrabold leading-none sm:text-xl ${selected ? 'bg-white text-accent-700' : 'bg-accent-50 text-accent-800'}`}>
                      {formatPrice(displayOptionPrice)}
                    </span>
                    {compareOptionPrice > displayOptionPrice && <span className="mb-1 text-[11px] font-semibold text-gray-400 line-through">{formatPrice(compareOptionPrice)}</span>}
                    <span className={`text-[12px] font-extrabold uppercase leading-snug sm:text-sm ${selected ? 'text-gray-950' : 'text-gray-800'}`}>{opt.label}</span>
                    {optionSoldOut && <span className="mt-2 rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-bold uppercase text-gray-600">Sold out</span>}
                    {selected && <span className="absolute right-2 top-2 h-3 w-3 rounded-full bg-accent-600 ring-4 ring-accent-100" />}
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
                <label className={`relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl bg-white px-4 py-5 text-center transition-colors hover:bg-primary-50 ${uploadingFields[field.label] ? 'pointer-events-none opacity-80' : ''}`}>
                  {uploadingFields[field.label] ? <FiLoader size={28} className="animate-spin text-primary-600" /> : <FiUpload size={24} className="text-primary-600" />}
                  <span className="text-sm font-semibold text-gray-800">{uploadingFields[field.label] ? 'Uploading file...' : 'Upload photo or artwork'}</span>
                  <span className="text-xs text-gray-500">JPG, PNG, WEBP, GIF, HEIC, HEIF or PDF up to 200 MB</span>
                  <input type="file" accept="image/*,.heic,.heif,.pdf" className="sr-only" disabled={uploadingFields[field.label]}
                    onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; handleCustomizationFileUpload(field.label, file); }} />
                </label>
                {uploadingFields[field.label] && <p className="mt-2 text-xs font-semibold text-primary-600">Uploading original file...</p>}
                {customFieldValues[field.label]?.url && (
                  <div className="mt-3 flex items-center gap-3 rounded-xl bg-white border border-primary-100 p-3">
                    <FiImage size={18} className="text-accent-500 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-800">{customFieldValues[field.label].name}</p>
                      <a href={displayUploadUrl(customFieldValues[field.label])} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-primary-600 hover:text-primary-700">Preview uploaded file</a>
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


        {customerNotesEnabled && (
          <div className="mb-5 rounded-2xl border border-primary-100 bg-white p-4">
            <label className="block text-sm font-bold text-gray-900 mb-2">Customer Notes <span className="text-gray-400 font-medium">(optional)</span></label>
            <textarea value={customerNote} onChange={e => setCustomerNote(e.target.value)} rows={3} className="w-full rounded-xl border px-4 py-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100" placeholder="Special instructions for this product..." />
          </div>
        )}


        {(needsCustomerPhotos || selectedVariantUploadOptions.length > 0 || needsCollageUploads) && (
          <div className="mb-5 rounded-2xl border border-primary-100 bg-white p-4">
            <p className="font-display text-sm font-bold text-gray-950">{previewConfig.title || 'Preview Your Personalized Gift'}</p>
            <p className="mt-2 text-xs leading-5 text-gray-600">
              Upload clear, high-quality photos for the best printing results. Basic clarity and alignment may be applied while keeping your original photo. Your frame automatically switches between portrait and landscape to match each photo. Use Edit if you want to fit, fill, crop, or rotate. Any uncovered white space shown in the preview may also appear in the final print.
            </p>
            {previewConfig.instructions ? <p className="mt-2 rounded-lg bg-primary-50 px-3 py-2 text-xs text-primary-800">{previewConfig.instructions}</p> : null}
          </div>
        )}
        {selectedVariantUploadOptions.length > 0 && (
          <div className="mb-5 rounded-2xl border border-primary-100 bg-primary-50/20 p-4">
            <div className="mb-3">
              <p className="text-sm font-bold text-gray-900">Selected variant image uploads</p>
              <p className="mt-1 text-xs text-gray-500">Upload the required image for each selected option label. These are saved label-wise for admin production.</p>
            </div>
            <div className={uploadCardGridClass}>
            {selectedVariantUploadOptions.map((selected) => {
              const upload = variantLabelUploads[selected.label];
              const isUploading = !!uploadingVariantLabels[selected.label];
                    const previewKey = `variant-${selected.label}`;
                    const adjustments = getAreaAdjustments(previewKey);
                    const variantArea = variantAreaFromSelected(selected);
                    const oriented = getFrameSize(variantArea, adjustments.orientation);
                    return (
                  <PhotoUploadCard
                    key={selected.label}
                    label={selected.label}
                    sizeLabel={areaSizeLabel(variantArea, previewKey)}
                    required
                    missingRequired={!upload?.url}
                    photo={upload}
                    photoUrl={displayUploadUrl(upload)}
                    uploading={isUploading}
                    disabled={Boolean(actionLoading) || savingPreviewAreas[previewKey]}
                    orientation={adjustments.orientation}
                    orientationLabel={upload?.url ? orientationCaption(adjustments.orientation) : ''}
                    aspectWidth={oriented.width}
                    aspectHeight={oriented.height}
                    fitMode={adjustments.fitMode}
                    onUpload={(files) => handleVariantLabelUpload(selected.label, files[0])}
                    onRemove={() => removeVariantLabelUpload(selected.label)}
                    onEdit={upload?.url ? () => setEditorSlotKey(previewKey) : undefined}
                    instructions={selected.previewInstructions || ''}
                  />
              );
            })}
            </div>
          </div>
        )}
        {needsCustomerPhotos && (
          <div className="mb-5 rounded-2xl border border-accent-100 bg-accent-50/20 p-4">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-bold text-gray-900">Customer photo areas</p>
                <p className="mt-1 text-xs text-gray-500">
                  {requiredPhotoCount > 0
                    ? `Please upload ${requiredPhotoCount} photo${requiredPhotoCount === 1 ? '' : 's'} for this product.`
                    : `You can upload up to ${maxPhotoCount} photo${maxPhotoCount === 1 ? '' : 's'} for this product.`}
                  {photoSlotCount > 1 ? ' You can select several photos at once; each photo fills the next empty frame.' : ''}
                </p>
              </div>
              <span className="self-start rounded-full border border-accent-100 bg-white px-3 py-1 text-xs font-bold text-accent-700">
                {uploadedPhotoCount}/{requiredPhotoCount || maxPhotoCount}
              </span>
            </div>
            {photoSlotCount > 1 ? (
              <label className={`mb-3 flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-accent-200 bg-white px-4 text-sm font-semibold text-accent-800 ${uploadingCustomerPhotos || Boolean(actionLoading) ? 'pointer-events-none opacity-70' : ''}`}>
                {uploadingCustomerPhotos ? 'Uploading photos...' : `Upload photos (${uploadedPhotoCount}/${photoSlotCount})`}
                <input
                  type="file"
                  accept="image/*,.heic,.heif"
                  multiple
                  className="sr-only"
                  disabled={uploadingCustomerPhotos || Boolean(actionLoading)}
                  onChange={(event) => {
                    const files = Array.from(event.target.files || []);
                    event.target.value = '';
                    if (files.length) handleCustomerPhotoUpload(files);
                  }}
                />
              </label>
            ) : null}
            <div className={uploadCardGridClass}>
              {Array.from({ length: photoSlotCount }, (_, idx) => {
                const area = previewAreas[idx] || { label: `Photo ${idx + 1}`, width: 1, height: 1, unit: 'ratio' };
                const photo = customerPhotos[idx];
                const slotRequired = previewAreas[idx] ? previewAreas[idx].required !== false : idx < requiredPhotoCount;
                const label = area?.label || `Photo ${idx + 1}`;
                const adjustments = getAreaAdjustments(idx);
                const oriented = getFrameSize(area, adjustments.orientation);
                return (
                  <PhotoUploadCard
                    key={`photo-slot-${idx}`}
                    label={label}
                    sizeLabel={areaSizeLabel(area, idx)}
                    required={slotRequired}
                    missingRequired={slotRequired && !photo?.url}
                    photo={photo}
                    photoUrl={displayUploadUrl(photo)}
                    uploading={!!uploadingPhotoSlots[idx]}
                    disabled={previewSaveLocksRef.current.size > 0 || Boolean(actionLoading) || uploadingCustomerPhotos}
                    orientation={adjustments.orientation}
                    orientationLabel={photo?.url ? orientationCaption(adjustments.orientation) : ''}
                    aspectWidth={oriented.width}
                    aspectHeight={oriented.height}
                    fitMode={adjustments.fitMode}
                    multiple={!photo?.url && photoSlotCount > 1}
                    onUpload={(files) => handleCustomerPhotoUpload(files, files.length === 1 ? idx : null)}
                    onRemove={() => removeCustomerPhoto(idx)}
                    onEdit={photo?.url ? () => setEditorSlotKey(idx) : undefined}
                    instructions={area?.instructions || ''}
                  />
                );
              })}
                  </div>
          </div>
        )}

        {needsCollageUploads && (
          <div className="mb-5 space-y-4 rounded-2xl border border-primary-100 bg-primary-50/20 p-4">
              <p className="text-sm font-bold text-gray-900">Collage photo uploads</p>
            {collageTemplates.map((template) => {
              const label = template.label;
              const photos = collageUploads[label] || [];
              const min = Math.max(0, Number(template.minImages || 0));
              const max = Math.max(min, Number(template.maxImages || min || 0));
              const isUploading = !!uploadingCollageLabels[label];
              const belowMin = photos.length < min;
              return (
                <div key={label} className={`rounded-2xl border bg-white p-3 sm:p-4 ${belowMin ? 'border-red-400 ring-2 ring-red-100' : 'border-gray-200'}`}>
                  <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-extrabold text-gray-900">{label}</p>
                      <p className="text-xs text-gray-500">Upload between {min} and {max} images.</p>
                      {template.instructions ? <p className="mt-1 text-xs text-primary-700">{template.instructions}</p> : null}
                      {belowMin ? <p className="mt-1 text-xs font-semibold text-red-600" role="alert">Photo required</p> : null}
                    </div>
                    <span className={`self-start rounded-full border px-3 py-1 text-xs font-bold ${belowMin || photos.length > max ? 'border-red-100 bg-red-50 text-red-700' : 'border-emerald-100 bg-emerald-50 text-emerald-700'}`}>{photos.length}/{min}-{max}</span>
                  </div>
                  <div className={uploadCardGridClass}>
                      {photos.map((photo, idx) => (
                      <PhotoUploadCard
                        key={`${label}-${idx}-${photo.url || 'photo'}`}
                        label={`${label} ${idx + 1}`}
                        photo={photo}
                        photoUrl={displayUploadUrl(photo)}
                        uploading={isUploading}
                        onUpload={(files) => handleCollageReplace(label, idx, files[0])}
                        onRemove={() => removeCollagePhoto(label, photo.url)}
                        disabled={isUploading || Boolean(actionLoading)}
                      />
                    ))}
                    {photos.length < max ? (
                      <PhotoUploadCard
                        key={`${label}-add`}
                        label={`${label} ${photos.length + 1}`}
                        required={belowMin}
                        missingRequired={belowMin}
                        uploading={isUploading}
                        disabled={isUploading || Boolean(actionLoading)}
                        multiple
                        onUpload={(files) => handleCollageUpload(label, files)}
                      />
                    ) : null}
                    </div>
                </div>
              );
            })}
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
              onClick={() => setQuantity(q => Math.min(purchaseLimit || q + 1, q + 1))}
              disabled={!product.isQuoteOnly && (isSoldOut || quantity >= purchaseLimit)}
              className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 transition-colors text-gray-600">
              <FiPlus size={16} />
            </button>
          </div>
          <span className="text-sm text-gray-500">{quantity > 1 ? `${quantity} x ${formatPrice(finalUnitPrice)}` : ''}</span>
        </div>

        <div className="mb-16 flex flex-col gap-3 pb-4 sm:mb-0 sm:flex-row">
          <button onClick={handleAddToCart} disabled={isSoldOut || Boolean(actionLoading)}
            className={`btn-primary flex-1 flex items-center justify-center gap-2 text-center ${isSoldOut || actionLoading ? 'opacity-60 cursor-not-allowed' : ''}`}>
            {actionLoading === 'cart' ? <><FiLoader size={18} className="animate-spin" /> Adding...</> : <><FiShoppingCart size={18} /> {isSoldOut ? 'Sold Out' : product.isQuoteOnly ? 'Contact for Price' : 'Add To Cart'}</>}
          </button>
          {!product.isQuoteOnly && !isSoldOut && (
            <button onClick={handleBuyNow} disabled={Boolean(actionLoading)} className={`btn-accent flex-1 flex items-center justify-center gap-2 text-center ${actionLoading ? 'opacity-60 cursor-not-allowed' : ''}`}>
              {actionLoading === 'buy' ? <><FiLoader size={18} className="animate-spin" /> Processing...</> : <><FiZap size={18} /> Buy It Now</>}
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


        {/* Product Reviews */}
        {(googleReviews.enabled || reviews.length > 0) && (
          <div className="mt-8 border-t pt-6">
            <div className="mb-4 flex items-center gap-2">
              <FiStar className="text-accent-500" />
              <h2 className="text-xl font-bold">Customer Submitted Reviews</h2>
            </div>
            {googleReviews.enabled && (
              <div className="space-y-4">
                <div className="rounded-3xl bg-gray-50 p-5 shadow-sm">
                  <p className="text-sm font-bold uppercase tracking-wide text-gray-500">{googleBusinessName}</p>
                  <p className="mt-1 text-lg font-bold"><span className="text-blue-500">G</span><span className="text-red-500">o</span><span className="text-yellow-500">o</span><span className="text-blue-500">g</span><span className="text-emerald-500">l</span><span className="text-red-500">e</span> Reviews</p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <span className="text-3xl font-extrabold text-gray-950">{googleRating ? googleRating.toFixed(1) : '0.0'}</span>
                    <div className="flex gap-1 text-yellow-400">{[1, 2, 3, 4, 5].map((star) => <FiStar key={star} className={star <= Math.round(googleRating) ? 'fill-yellow-400 stroke-yellow-400' : 'stroke-gray-300'} />)}</div>
                    <span className="text-sm text-gray-500">({googleReviewCount.toLocaleString('en-IN')})</span>
                  </div>
                </div>
                {googleReviewTopics.length > 0 && (
                  <div className="rounded-3xl bg-primary-50/70 p-5 shadow-sm">
                    <p className="text-sm font-extrabold text-primary-700">Review Highlights</p>
                    <ul className="mt-3 space-y-2 text-sm text-gray-700">
                      {googleReviewTopics.map((topic) => <li key={topic.keyword} className="flex gap-2"><span className="font-bold text-primary-600">-</span><span>{topic.keyword}{topic.mentions ? " (" + topic.mentions + ")" : ""}</span></li>)}
                    </ul>
                  </div>
                )}
                {visibleGoogleReviews.length > 0 && (
                  <div className="review-scroll w-full max-w-full overflow-x-auto overscroll-x-contain pb-3">
                    <div className="flex w-max snap-x snap-mandatory gap-3 pr-3">
                      {visibleGoogleReviews.map((review) => (
                        <div key={review.id} className="min-h-[210px] w-[calc(100vw-3rem)] max-w-[340px] shrink-0 snap-start rounded-3xl bg-gray-50 p-4 shadow-sm sm:w-[320px] sm:p-5">
                          <div className="flex items-start gap-3">
                            {review.avatar ? <img src={review.avatar} alt={review.name} className="h-11 w-11 rounded-full object-cover" /> : <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-700">{String(review.name || 'G').slice(0, 1)}</div>}
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2"><p className="font-bold text-gray-900">{review.name}</p><span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-600">Google</span></div>
                              {review.date && <p className="text-xs text-gray-400">{review.date}</p>}
                              <div className="mt-2 flex gap-0.5 text-yellow-400">{[1, 2, 3, 4, 5].map((star) => <FiStar key={star} size={15} className={star <= Number(review.rating || 0) ? 'fill-yellow-400 stroke-yellow-400' : 'stroke-gray-300'} />)}</div>
                              {review.text && <p className="mt-2 line-clamp-5 text-sm leading-6 text-gray-700">{review.text}</p>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {googleReviewImages.length > 0 && <div className="flex w-full max-w-full snap-x gap-3 overflow-x-auto overscroll-x-contain pb-2">{googleReviewImages.map((image, idx) => <img key={image + idx} src={image} alt="Google review image" className="h-28 w-28 shrink-0 snap-start rounded-xl border object-cover" />)}</div>}
              </div>
            )}
            {reviews.length > 0 && (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {reviews.slice(0, 4).map((review) => (
                  <div key={review._id} className="rounded-2xl border bg-white p-4 shadow-sm">
                    <div className="mb-2 flex items-center justify-between gap-3"><p className="font-bold text-gray-900">{review.name || 'Customer'}</p><div className="flex gap-0.5 text-accent-500">{[1, 2, 3, 4, 5].map((star) => <FiStar key={star} size={14} className={star <= Number(review.rating || 0) ? 'fill-accent-500 stroke-accent-500' : 'stroke-gray-300'} />)}</div></div>
                    <p className="text-sm leading-6 text-gray-600">{review.comment}</p>
                  </div>
                ))}
              </div>
            )}
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
            <div className="max-w-full overflow-x-auto"><table className="w-full min-w-[420px] border-collapse text-sm">
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
        </div>
      )}

      <PhotoAdjuster
        open={editorSlotKey !== null && Boolean(editorPhotoUrl)}
        label={editorArea?.label || 'Photo'}
        extraLabel={selectedVariantLabel}
        area={editorArea}
        photoUrl={editorPhotoUrl}
        baseline={editorSlotKey !== null ? getAreaAdjustments(editorSlotKey) : getDefaultPreviewAdjustments()}
        saving={Boolean(savingPreviewAreas[editorSlotKey])}
        replacing={Boolean(Number.isInteger(editorSlotKey) ? uploadingPhotoSlots[editorSlotKey] : uploadingVariantLabels[editorVariantLabel])}
        onClose={() => setEditorSlotKey(null)}
        onApply={async (draft) => {
          const saved = await savePreviewArea(editorSlotKey, draft);
          if (saved) setEditorSlotKey(null);
        }}
        onReplace={(file) => {
          if (editorIsVariant) handleVariantLabelUpload(editorVariantLabel, file);
          else handleCustomerPhotoUpload([file], editorSlotKey);
        }}
      />
      <PhotoLimitDialog
        open={Boolean(photoLimitPlan?.blocked)}
        max={photoLimitPlan?.max || photoSlotCount}
        used={photoLimitPlan?.used || uploadedPhotoCount}
        remaining={photoLimitPlan?.remaining || 0}
        selectedCount={photoLimitPlan?.selectedCount || 0}
        files={photoLimitPlan?.files || []}
        onCancel={() => setPhotoLimitPlan(null)}
        onUpload={(chosen) => {
          setPhotoLimitPlan(null);
          handleCustomerPhotoUpload(chosen);
        }}
      />
      {lightboxOpen && product.images?.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setLightboxOpen(false)}>
          <button className="absolute top-4 right-4 text-white hover:text-gray-300 z-50" onClick={() => setLightboxOpen(false)}><FiX size={28} /></button>
          <div className="max-w-4xl max-h-[90vh] relative" onClick={e => e.stopPropagation()} onTouchStart={handleLightboxTouchStart} onTouchMove={handleLightboxTouchMove} onTouchEnd={handleLightboxTouchEnd}>
            <img key={currentMedia?.type + ':' + currentMedia?.url} src={currentMedia?.type === 'image' ? currentMedia.url : imageItems[0]?.url} alt={product.title} className="max-w-full max-h-[85vh] object-contain rounded-lg" onError={(e) => { e.currentTarget.src = '/placeholder.svg'; }} />
            {mediaItems.length > 1 && <button type="button" onClick={goPrevMedia} className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-gray-900 shadow-lg" aria-label="Previous image"><FiChevronLeft size={24} /></button>}
            {mediaItems.length > 1 && <button type="button" onClick={goNextMedia} className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-gray-900 shadow-lg" aria-label="Next image"><FiChevronRight size={24} /></button>}
            {mediaItems.length > 1 && (
              <div className="flex justify-center gap-2 mt-4">
                {mediaItems.map((media, idx) => (
                  <button key={media.type + ':' + media.url + '-' + idx} onClick={() => setSelectedImage(idx)}
                    className={`w-16 h-16 rounded-lg overflow-hidden border-2 ${idx === selectedImage ? 'border-white' : 'border-transparent opacity-60'}`}>
                    <img src={media.url} alt="" className="w-full h-full object-cover" />
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




