import mongoose from 'mongoose';

const AdminSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: 'staff' },
  isPrimary: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  roleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Role', default: null },
  /** Per-staff permission deltas layered on top of role permissions. */
  permissionOverrides: { type: mongoose.Schema.Types.Mixed, default: {} },
  /** Optional staff-level visibility override (all|department|assigned|own). Empty = use role. */
  dataVisibility: { type: String, default: '', trim: true },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  assignedAt: Date,
}, { timestamps: true });

export default mongoose.models.Admin || mongoose.model('Admin', AdminSchema);
