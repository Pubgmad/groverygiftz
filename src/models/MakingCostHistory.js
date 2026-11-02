import mongoose from 'mongoose';

const MakingCostHistorySchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
  variantKey: { type: String, default: '' },
  variantName: { type: String, default: '' },
  optionLabel: { type: String, default: '' },
  amount: { type: Number, required: true, min: 0 },
  previousAmount: { type: Number, default: null },
  effectiveFrom: { type: Date, required: true, index: true },
  note: { type: String, default: '' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  updatedByEmail: { type: String, default: '' },
}, { timestamps: true });

MakingCostHistorySchema.index({ product: 1, variantKey: 1, effectiveFrom: -1 });

export default mongoose.models.MakingCostHistory || mongoose.model('MakingCostHistory', MakingCostHistorySchema);
