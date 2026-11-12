import mongoose from 'mongoose';

const PhotoFrameDesignProfileSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, trim: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '', maxlength: 500 },
  mode: { type: String, enum: ['procedural', 'custom_glb'], default: 'procedural' },
  frameColor: { type: String, default: '#1a1a1a' },
  accentColor: { type: String, default: '#2a2a2a' },
  material: {
    roughness: { type: Number, default: 0.75 },
    metalness: { type: Number, default: 0.08 },
  },
  modelUrl: { type: String, default: '' },
  assetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Preview3dAsset', default: null },
  compatibleSizeKeys: { type: [String], default: [] },
  lockedSizeKey: { type: String, default: '' },
  mouldingProfileKey: { type: String, default: '' },
  customerReadiness: {
    type: String,
    enum: ['draft', 'validation_required', 'approved'],
    default: 'draft',
  },
  ownerReferenceUrls: { type: [String], default: [] },
  fidelity: {
    type: String,
    enum: ['owner_confirmed', 'visually_verified', 'approximate', 'unverified'],
    default: 'approximate',
  },
  isActive: { type: Boolean, default: true },
  notes: { type: String, default: '', maxlength: 400 },
}, { timestamps: true });

export default mongoose.models.PhotoFrameDesignProfile
  || mongoose.model('PhotoFrameDesignProfile', PhotoFrameDesignProfileSchema);
