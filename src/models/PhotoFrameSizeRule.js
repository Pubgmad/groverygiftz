import mongoose from 'mongoose';

const PhotoFrameSizeRuleSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, lowercase: true, trim: true },
  label: { type: String, required: true, trim: true },
  nominalWidth: { type: Number, required: true },
  nominalHeight: { type: Number, required: true },
  /** Optional: when unset, opening defaults to nominal (Admin may override per product). */
  openingWidth: { type: Number, default: null },
  openingHeight: { type: Number, default: null },
  borderWidth: { type: Number, required: true },
  borderGroup: { type: String, enum: ['A', 'B', 'C', 'custom'], default: 'custom' },
  hardwareProfileKey: { type: String, default: '', trim: true },
  orientation: {
    type: String,
    enum: ['auto', 'portrait', 'landscape', 'square'],
    default: 'auto',
  },
  unit: { type: String, enum: ['inch', 'cm', 'mm'], default: 'inch' },
  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
  notes: { type: String, default: '', maxlength: 400 },
}, { timestamps: true });

export default mongoose.models.PhotoFrameSizeRule
  || mongoose.model('PhotoFrameSizeRule', PhotoFrameSizeRuleSchema);
