import mongoose from 'mongoose';

const ComponentSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: false },
  fidelity: {
    type: String,
    enum: ['owner_confirmed', 'visually_verified', 'approximate', 'unverified'],
    default: 'approximate',
  },
}, { _id: false });

const PhotoFrameHardwareProfileSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, trim: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '', maxlength: 500 },
  /** Explicit size membership — never inferred by numeric ranges alone. */
  sizeRuleKeys: { type: [String], default: [] },
  referenceImage: { type: String, default: '' },
  components: {
    stand: { type: ComponentSchema, default: () => ({}) },
    centerHook: { type: ComponentSchema, default: () => ({}) },
    leftHook: { type: ComponentSchema, default: () => ({}) },
    rightHook: { type: ComponentSchema, default: () => ({}) },
    leftBush: { type: ComponentSchema, default: () => ({}) },
    rightBush: { type: ComponentSchema, default: () => ({}) },
    backingPanel: { type: ComponentSchema, default: () => ({ enabled: true }) },
  },
  isActive: { type: Boolean, default: true },
  notes: { type: String, default: '', maxlength: 400 },
}, { timestamps: true });

export default mongoose.models.PhotoFrameHardwareProfile
  || mongoose.model('PhotoFrameHardwareProfile', PhotoFrameHardwareProfileSchema);
