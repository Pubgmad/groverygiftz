import mongoose from 'mongoose';

const PageSchema = new mongoose.Schema({
  title: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  content: { type: String, default: '' },
  type: { type: String, enum: ['about', 'contact', 'privacy-policy', 'terms-conditions', 'shipping-policy', 'refund-policy'] },
}, { timestamps: true });

export default mongoose.models.Page || mongoose.model('Page', PageSchema);
