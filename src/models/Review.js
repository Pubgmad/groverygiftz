import mongoose from 'mongoose';

const ReviewSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  orderNumber: { type: String, default: '' },
  productName: { type: String, default: '' },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, required: true, trim: true, maxlength: 1000 },
  verified: { type: Boolean, default: false },
}, { timestamps: true });

export default mongoose.models.Review || mongoose.model('Review', ReviewSchema);