import mongoose from 'mongoose';

const OpsTaskSchema = new mongoose.Schema({
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
  orderNumber: { type: String, default: '', index: true },
  type: {
    type: String,
    enum: ['sales', 'editing', 'printing', 'production', 'packing', 'dispatch'],
    required: true,
    index: true,
  },
  title: { type: String, default: '' },
  priority: { type: String, enum: ['low', 'normal', 'high', 'urgent'], default: 'normal', index: true },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'cancelled', 'blocked'],
    default: 'pending',
    index: true,
  },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', index: true },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  startDate: Date,
  dueDate: { type: Date, index: true },
  completedAt: Date,
  notes: { type: String, default: '' },
  history: [{
    at: { type: Date, default: Date.now },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    action: String,
    from: String,
    to: String,
    note: String,
  }],
}, { timestamps: true });

OpsTaskSchema.index({ assignedTo: 1, status: 1, dueDate: 1 });
OpsTaskSchema.index({ type: 1, status: 1, dueDate: 1 });

export default mongoose.models.OpsTask || mongoose.model('OpsTask', OpsTaskSchema);
