import mongoose from 'mongoose';

const AdminAuditLogSchema = new mongoose.Schema({
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  actorEmail: { type: String, default: '' },
  action: { type: String, required: true },
  targetType: { type: String, default: '' },
  targetId: { type: String, default: '' },
  details: { type: mongoose.Schema.Types.Mixed, default: {} },
  ip: { type: String, default: '' },
  userAgent: { type: String, default: '' },
}, { timestamps: true });

AdminAuditLogSchema.index({ createdAt: -1 });

export default mongoose.models.AdminAuditLog || mongoose.model('AdminAuditLog', AdminAuditLogSchema);
