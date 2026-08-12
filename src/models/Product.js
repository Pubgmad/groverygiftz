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
  images: [String],
  responsiveImages: { type: ResponsiveImagesSchema, default: () => ({ desktop: [], tablet: [], mobile: [] }) },
  productVideo: {
    url: { type: String, default: '' },
    name: { type: String, default: '' },
    poster: { type: String, default: '' },
  },
  customizationPreview: {
    enabled: { type: Boolean, default: false },
    title: { type: String, default: 'Preview your personalized gift' },
    frameImage: { type: String, default: '' },
    aspectRatio: { type: String, default: '1:1' },
    shape: { type: String, enum: ['rectangle', 'circle', 'rounded'], default: 'rectangle' },
    instructions: { type: String, default: '' },
    requiredImageCount: { type: Number, default: 0 },
    maxImageCount: { type: Number, default: 0 },
    areas: [PreviewAreaSchema],
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
  isQuoteOnly: { type: Boolean, default: false },
  isFeatured: { type: Boolean, default: false },
  isBestSeller: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  seoTitle: String,
  seoDescription: String,
}, { timestamps: true });

ProductSchema.index({ title: 'text', description: 'text' });

export default mongoose.models.Product || mongoose.model('Product', ProductSchema);
