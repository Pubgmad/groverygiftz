import mongoose from 'mongoose';

const MakingCostSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
  variantKey: { type: String, default: '' },
  variantName: { type: String, default: '' },
  optionLabel: { type: String, default: '' },
  amount: { type: Number, required: true, min: 0 },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  updatedByEmail: { type: String, default: '' },
}, { timestamps: true });

MakingCostSchema.index({ product: 1, variantKey: 1 }, { unique: true });

export default mongoose.models.MakingCost || mongoose.model('MakingCost', MakingCostSchema);
