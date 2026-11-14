import mongoose from 'mongoose';

const NotificationJobSchema = new mongoose.Schema({
  uniqueKey: { type: String, required: true, unique: true, index: true },
  type: { type: String, required: true, default: 'order-confirmation' },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
  orderNumber: { type: String, default: '' },
  to: { type: String, default: '' },
  templateVersion: { type: String, default: 'order-confirmation-v1' },
  status: {
    type: String,
    enum: ['pending', 'processing', 'sent', 'failed', 'skipped'],
    default: 'pending',
    index: true,
  },
  attempts: { type: Number, default: 0 },
  nextRetryAt: { type: Date, default: Date.now, index: true },
  lastError: { type: String, default: '' },
  smtpAcceptedAt: Date,
  messageId: { type: String, default: '' },
  rawRfc822: { type: String, default: '', select: false },
  archiveStatus: {
    type: String,
    enum: ['pending', 'processing', 'archived', 'failed', 'skipped', ''],
    default: '',
    index: true,
  },
  archiveAttempts: { type: Number, default: 0 },
  archiveNextRetryAt: { type: Date, default: Date.now, index: true },
  archiveLastError: { type: String, default: '' },
  archivedAt: Date,
  archiveFolder: { type: String, default: '' },
  claimedAt: Date,
  archiveClaimedAt: Date,
}, { timestamps: true });

NotificationJobSchema.index({ type: 1, status: 1, nextRetryAt: 1 });
NotificationJobSchema.index({ type: 1, archiveStatus: 1, archiveNextRetryAt: 1 });

export default mongoose.models.NotificationJob || mongoose.model('NotificationJob', NotificationJobSchema);
