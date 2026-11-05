import mongoose from 'mongoose';

const RoleSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 60 },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  description: { type: String, default: '', maxlength: 300 },
  isActive: { type: Boolean, default: true },
  permissions: { type: mongoose.Schema.Types.Mixed, default: {} },
  /** all | department | assigned | own — default assigned for staff-facing roles */
  dataVisibility: { type: String, default: 'assigned', trim: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
}, { timestamps: true });

export default mongoose.models.Role || mongoose.model('Role', RoleSchema);
