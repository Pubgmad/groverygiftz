import mongoose from 'mongoose';

const DispatchBatchSchema = new mongoose.Schema({
  batchCode: { type: String, required: true, unique: true },
  courierCompany: { type: String, default: '' },
  pickupDate: Date,
  pickupConfirmedAt: Date,
  notes: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  orderIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }],
  orderNumbers: [{ type: String }],
  parcelCount: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['draft', 'pickup_pending', 'pickup_arranged', 'handed_over'],
    default: 'pickup_pending',
  },
}, { timestamps: true });

export default mongoose.models.DispatchBatch || mongoose.model('DispatchBatch', DispatchBatchSchema);
