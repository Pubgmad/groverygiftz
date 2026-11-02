import mongoose from 'mongoose';

const AdminSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: 'staff' },
  isPrimary: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  roleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Role', default: null },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  assignedAt: Date,
}, { timestamps: true });

export default mongoose.models.Admin || mongoose.model('Admin', AdminSchema);
