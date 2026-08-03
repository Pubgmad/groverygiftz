import mongoose from 'mongoose';

const ProductSchema = new mongoose.Schema({
  title: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  description: { type: String, default: '' },
  images: [String],
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
      stock: Number,
      inStock: { type: Boolean, default: true },
    }],
  }],
  customFields: [{
    label: String,
    type: { type: String, enum: ['text', 'file', 'textarea'] },
    required: { type: Boolean, default: false },
  }],
  giftWrap: { enabled: { type: Boolean, default: false }, price: { type: Number, default: 20 } },
  giftMessage: { type: Boolean, default: false },
  isQuoteOnly: { type: Boolean, default: false },
  isFeatured: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  seoTitle: String,
  seoDescription: String,
}, { timestamps: true });

ProductSchema.index({ title: 'text', description: 'text' });

export default mongoose.models.Product || mongoose.model('Product', ProductSchema);
