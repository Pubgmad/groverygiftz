import mongoose from 'mongoose';

const SurfaceSchema = new mongoose.Schema({
  id: { type: String, required: true, trim: true },
  label: { type: String, default: '', trim: true },
  kind: { type: String, default: 'plane', trim: true },
  /** Stable GLB mesh identifiers for named surface mapping */
  meshName: { type: String, default: '', trim: true },
  meshPath: { type: String, default: '', trim: true },
  materialName: { type: String, default: '', trim: true },
  hasUvs: { type: Boolean, default: true },
  uvWarning: { type: String, default: '', trim: true },
  preview3dAppearance: {
    type: String,
    enum: ['', 'metal_engraving'],
    default: '',
  },
  approximateGeometry: { type: Boolean, default: false },
}, { _id: false });

const Preview3dProfileSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  description: { type: String, default: '', maxlength: 400 },
  isActive: { type: Boolean, default: true },
  geometryType: {
    type: String,
    enum: ['single_plane', 'photo_frame', 'multi_grid', 'cylinder', 'pendant', 'custom_glb'],
    default: 'single_plane',
  },
  modelUrl: { type: String, default: '' },
  placeholderUrl: { type: String, default: '' },
  assetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Preview3dAsset', default: null },
  retailReadiness: {
    type: String,
    enum: ['prototype', 'awaiting_approval', 'approved_retail'],
    default: 'prototype',
  },
  environment: {
    type: String,
    enum: ['studio', 'wall', 'table', 'none'],
    default: 'studio',
  },
  frameColor: { type: String, default: '#f5f0e8' },
  accentColor: { type: String, default: '#8b7355' },
  camera: {
    minDistance: { type: Number, default: 1.2 },
    maxDistance: { type: Number, default: 6 },
    autoRotate: { type: Boolean, default: false },
    targetY: { type: Number, default: null },
  },
  dimensions: {
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    depth: { type: Number, default: null },
    unit: { type: String, enum: ['inch', 'cm', 'mm'], default: 'inch' },
    modelScale: { type: Number, default: null },
  },
  layout: {
    mode: { type: String, enum: ['auto_grid', 'wall_row', 'wall_grid', 'manual'], default: 'auto_grid' },
    columns: { type: Number, default: 0 },
    gap: { type: Number, default: 0.16 },
    cellScale: { type: Number, default: 0.9 },
    positions: [{
      surfaceId: { type: String, default: '' },
      x: { type: Number, default: 0 },
      y: { type: Number, default: 0 },
      z: { type: Number, default: 0 },
      scale: { type: Number, default: 1 },
    }],
  },
  surfaces: { type: [SurfaceSchema], default: [] },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
}, { timestamps: true });

export default mongoose.models.Preview3dProfile
  || mongoose.model('Preview3dProfile', Preview3dProfileSchema);
