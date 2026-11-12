import mongoose from 'mongoose';

/**
 * Registry of reusable Admin 3D model files (GLB).
 * Does not store binary bytes — points at uploadStorage public URLs.
 * Upload success ≠ retail approval.
 */
const SurfaceHintSchema = new mongoose.Schema({
  id: { type: String, default: '', trim: true },
  label: { type: String, default: '', trim: true },
  meshName: { type: String, default: '', trim: true },
  meshPath: { type: String, default: '', trim: true },
  materialName: { type: String, default: '', trim: true },
  hasUvs: { type: Boolean, default: true },
  preview3dAppearance: {
    type: String,
    enum: ['', 'metal_engraving'],
    default: '',
  },
  approximateGeometry: { type: Boolean, default: false },
}, { _id: false });

const Preview3dAssetSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  url: { type: String, required: true, trim: true },
  relativePath: { type: String, default: '', trim: true },
  originalFilename: { type: String, default: '', trim: true },
  kind: { type: String, enum: ['model', 'placeholder'], default: 'model' },
  geometryHint: {
    type: String,
    enum: ['single_plane', 'multi_grid', 'cylinder', 'pendant', 'custom_glb', ''],
    default: 'custom_glb',
  },
  retailReadiness: {
    type: String,
    enum: ['prototype', 'awaiting_approval', 'approved_retail'],
    default: 'prototype',
  },
  isAccessible: { type: Boolean, default: true },
  notes: { type: String, default: '', maxlength: 400 },
  surfaceHints: { type: [SurfaceHintSchema], default: [] },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
}, { timestamps: true });

Preview3dAssetSchema.index({ url: 1 }, { unique: true });
Preview3dAssetSchema.index({ retailReadiness: 1, kind: 1 });

export default mongoose.models.Preview3dAsset
  || mongoose.model('Preview3dAsset', Preview3dAssetSchema);
