import mongoose from 'mongoose';

const OpsNotificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true, index: true },
  type: { type: String, required: true, index: true },
  title: { type: String, default: '' },
  body: { type: String, default: '' },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  orderNumber: { type: String, default: '' },
  task: { type: mongoose.Schema.Types.ObjectId, ref: 'OpsTask' },
  readAt: Date,
  meta: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

OpsNotificationSchema.index({ recipient: 1, readAt: 1, createdAt: -1 });

export default mongoose.models.OpsNotification || mongoose.model('OpsNotification', OpsNotificationSchema);
