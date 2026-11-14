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
  claimedAt: Date,
}, { timestamps: true });

NotificationJobSchema.index({ type: 1, status: 1, nextRetryAt: 1 });

export default mongoose.models.NotificationJob || mongoose.model('NotificationJob', NotificationJobSchema);
