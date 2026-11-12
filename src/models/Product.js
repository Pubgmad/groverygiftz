import mongoose from 'mongoose';

const PreviewAreaSchema = new mongoose.Schema({
  label: { type: String, default: '' },
  requiresImageUpload: { type: Boolean, default: true },
  width: { type: Number, default: 0 },
  height: { type: Number, default: 0 },
  unit: { type: String, default: 'inch' },
  frameImage: { type: String, default: '' },
  shape: { type: String, enum: ['rectangle', 'circle', 'rounded'], default: 'rectangle' },
  required: { type: Boolean, default: true },
  instructions: { type: String, default: '' },
}, { _id: false });

const ResponsiveImagesSchema = new mongoose.Schema({
  desktop: [String],
  tablet: [String],
  mobile: [String],
}, { _id: false });

const StateDeliveryOverrideSchema = new mongoose.Schema({
  state: { type: String, default: '' },
  shippingCost: { type: Number, default: 0 },
  deliveryEstimate: { type: String, default: '' },
}, { _id: false });
const CollageTemplateSchema = new mongoose.Schema({
  label: { type: String, default: '' },
  minImages: { type: Number, default: 1 },
  maxImages: { type: Number, default: 1 },
  instructions: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
}, { _id: false });

const ProductSchema = new mongoose.Schema({
  title: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  description: { type: String, default: '' },
  aboutThisProduct: {
    instructions: { type: String, default: '' },
    deliveryNotes: { type: String, default: '' },
    hideDescription: { type: Boolean, default: false },
    hideInstructions: { type: Boolean, default: false },
    hideDelivery: { type: Boolean, default: false },
  },
  // Legacy per-product FAQs retained for compatibility; customer pages use Settings.productFaqs.
  faqs: [{
    question: { type: String, default: '' },
    answer: { type: String, default: '' },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  }],
  images: [String],
  responsiveImages: { type: ResponsiveImagesSchema, default: () => ({ desktop: [], tablet: [], mobile: [] }) },
  productVideo: {
    url: { type: String, default: '' },
    name: { type: String, default: '' },
    poster: { type: String, default: '' },
  },
  makingVideosSection: {
    enabled: { type: Boolean, default: true },
    heading: { type: String, default: 'See How Your Gift Is Made' },
  },
  makingVideos: [{
    url: { type: String, default: '' },
    name: { type: String, default: '' },
    poster: { type: String, default: '' },
    title: { type: String, default: '' },
    description: { type: String, default: '' },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  }],
  customizationPreview: {
    enabled: { type: Boolean, default: false },
    title: { type: String, default: 'Preview your personalized gift' },
    frameImage: { type: String, default: '' },
    aspectRatio: { type: String, default: '1:1' },
    shape: { type: String, enum: ['rectangle', 'circle', 'rounded'], default: 'rectangle' },
    instructions: { type: String, default: '' },
    shortGuidance: { type: String, default: '' },
    requiredImageCount: { type: Number, default: 0 },
    maxImageCount: { type: Number, default: 0 },
    areas: [PreviewAreaSchema],
  },
  stockAlert: {
    enabled: { type: Boolean, default: true },
    lowStockThreshold: { type: Number, default: 5 },
    mediumStockThreshold: { type: Number, default: 20 },
    lowStockLabel: { type: String, default: '' },
    mediumStockLabel: { type: String, default: '' },
    highStockLabel: { type: String, default: '' },
    soldOutLabel: { type: String, default: '' },
  },
  purchaseActivity: {
    enabled: { type: Boolean, default: false },
    purchaseCount: { type: Number, default: 0 },
    timeQuantity: { type: Number, default: 24 },
    timeUnit: { type: String, enum: ['hours', 'days'], default: 'hours' },
    labelTemplate: { type: String, default: '' },
  },
  /** Promotional estimated interest (not verified live analytics). */
  productInterest: {
    enabled: { type: Boolean, default: true },
    minViews: { type: Number, default: 250 },
    maxViews: { type: Number, default: 1000 },
    labelTemplate: { type: String, default: '' },
  },
  /**
   * Optional Universal 3D preview (Phase 1).
   * Default disabled — never required for save, cart, or checkout.
   */
  preview3d: {
    enabled: { type: Boolean, default: false },
    profileId: { type: mongoose.Schema.Types.ObjectId, ref: 'Preview3dProfile', default: null },
    assetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Preview3dAsset', default: null },
    geometryType: {
      type: String,
      enum: ['single_plane', 'photo_frame', 'multi_grid', 'cylinder', 'pendant', 'custom_glb'],
      default: 'single_plane',
    },
    modelUrl: { type: String, default: '' },
    placeholderUrl: { type: String, default: '' },
    environment: {
      type: String,
      enum: ['studio', 'wall', 'table', 'none'],
      default: 'studio',
    },
    frameColor: { type: String, default: '#f5f0e8' },
    accentColor: { type: String, default: '#8b7355' },
    /** Owner retail gate — independent of technical validity / GLB upload success. */
    retailReadiness: {
      type: String,
      enum: ['prototype', 'awaiting_approval', 'approved_retail'],
      default: 'prototype',
    },
    camera: {
      minDistance: { type: Number, default: 1.2 },
      maxDistance: { type: Number, default: 6 },
      autoRotate: { type: Boolean, default: false },
      /** Optional look-at Y bias for tall GLBs (meters). null = auto center. */
      targetY: { type: Number, default: null },
    },
    /** Explicit procedural dimensions (never inferred from product titles). */
    dimensions: {
      width: { type: Number, default: null },
      height: { type: Number, default: null },
      depth: { type: Number, default: null },
      unit: { type: String, enum: ['inch', 'cm', 'mm'], default: 'inch' },
      /** Optional uniform GLB scale — never derived from photo opening size. */
      modelScale: { type: Number, default: null },
    },
    /**
     * Optional 3D overrides keyed by stable variantName::optionLabel.
     * Does not affect pricing, stock, or cart selection.
     */
    variantOverrides: [{
      key: { type: String, default: '' },
      variantName: { type: String, default: '' },
      optionLabel: { type: String, default: '' },
      enabled: { type: Boolean, default: true },
      geometryType: {
        type: String,
        enum: ['', 'single_plane', 'photo_frame', 'multi_grid', 'cylinder', 'pendant', 'custom_glb'],
        default: '',
      },
      modelUrl: { type: String, default: '' },
      assetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Preview3dAsset', default: null },
      profileId: { type: mongoose.Schema.Types.ObjectId, ref: 'Preview3dProfile', default: null },
      frameColor: { type: String, default: '' },
      accentColor: { type: String, default: '' },
      dimensions: {
        width: { type: Number, default: null },
        height: { type: Number, default: null },
        depth: { type: Number, default: null },
        unit: { type: String, enum: ['inch', 'cm', 'mm'], default: 'inch' },
        modelScale: { type: Number, default: null },
      },
    }],
    /** Admin-configured multi-frame wall arrangement (never product-name hardcoded). */
    layout: {
      mode: { type: String, enum: ['auto_grid', 'wall_row', 'wall_grid', 'manual'], default: 'auto_grid' },
      columns: { type: Number, default: 0 },
      gap: { type: Number, default: 0.16 },
      cellScale: { type: Number, default: 0.9 },
      positions: [{
        surfaceId: { type: String, default: '' },
        x: { type: Number, default: 0 },
        y: { type: Number, default: 0 },
        z: { type: Number, default: 0 },
        scale: { type: Number, default: 1 },
      }],
    },
    surfaces: [{
      id: { type: String, default: '' },
      label: { type: String, default: '' },
      kind: { type: String, default: 'plane' },
      meshName: { type: String, default: '' },
      meshPath: { type: String, default: '' },
      materialName: { type: String, default: '' },
      hasUvs: { type: Boolean, default: true },
      uvWarning: { type: String, default: '' },
      preview3dAppearance: {
        type: String,
        enum: ['', 'metal_engraving'],
        default: '',
      },
      approximateGeometry: { type: Boolean, default: false },
    }],
    surfaceMappings: [{
      slotKey: { type: String, default: '' },
      surfaceId: { type: String, default: '' },
      areaLabel: { type: String, default: '' },
    }],
    legacySequentialGlb: { type: Boolean, default: false },
    /**
     * Photo-frame family config (size rule, borders, hardware, design).
     * Stored as Mixed; normalized via normalizePhotoFrameConfig on save/API.
     */
    photoFrame: { type: mongoose.Schema.Types.Mixed, default: null },
    notes: { type: String, default: '' },
  },
  regularPrice: { type: Number, required: true },
  salePrice: { type: Number },
  offerStartsAt: Date,
  offerEndsAt: Date,
  stock: { type: Number, default: 0 },
  collections: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Collection' }],
  variants: [{
    name: String,
    type: { type: String, enum: ['size', 'color', 'quantity'] },
    options: [{
      label: String,
      priceAdjustment: { type: Number, default: 0 },
      price: { type: Number, default: 0 },
      useOwnPrice: { type: Boolean, default: false },
      regularPrice: { type: Number, default: 0 },
      salePrice: { type: Number, default: 0 },
      stateOverrides: [StateDeliveryOverrideSchema],
      shippingTemplate: { type: mongoose.Schema.Types.ObjectId, ref: 'ShippingTemplate' },
      requiresImageUpload: { type: Boolean, default: false },
      previewWidth: { type: Number, default: 0 },
      previewHeight: { type: Number, default: 0 },
      previewUnit: { type: String, default: 'inch' },
      previewFrameImage: { type: String, default: '' },
      previewInstructions: { type: String, default: '' },
      stock: Number,
      inStock: { type: Boolean, default: true },
    }],
  }],
  customFields: [{
    label: String,
    type: { type: String, enum: ['text', 'file', 'textarea'] },
    required: { type: Boolean, default: false },
  }],
  collageEnabled: { type: Boolean, default: false },
  collageTemplates: [CollageTemplateSchema],
  delivery: {
    useCustomDelivery: { type: Boolean, default: false },
    tamilNaduShippingCost: { type: Number, default: 0 },
    otherStateShippingCost: { type: Number, default: 0 },
    tamilNaduDeliveryEstimate: { type: String, default: '' },
    otherStateDeliveryEstimate: { type: String, default: '' },
    stateOverrides: [StateDeliveryOverrideSchema],
    shippingTemplate: { type: mongoose.Schema.Types.ObjectId, ref: 'ShippingTemplate' },
  },
  giftWrap: { enabled: { type: Boolean, default: false }, price: { type: Number, default: 20 } },
  giftMessage: { type: Boolean, default: false },
  customerNotesEnabled: { type: Boolean, default: true },
  isQuoteOnly: { type: Boolean, default: false },
  isOffer: { type: Boolean, default: false },
  isFeatured: { type: Boolean, default: false },
  isBestSeller: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  seoTitle: String,
  seoDescription: String,
}, { timestamps: true });

ProductSchema.index({ title: 'text', description: 'text' });

export default mongoose.models.Product || mongoose.model('Product', ProductSchema);
