import mongoose from 'mongoose';

const ParcelRecordSchema = new mongoose.Schema({
  parcelCode: { type: String, required: true },
  orderIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }],
  orderNumbers: [{ type: String }],
  trackingNumber: { type: String, default: '' },
  trackingUrl: { type: String, default: '' },
  weightKg: { type: Number, default: null },
  /** Set only when handed to courier — not at batch arrange time. */
  dispatchedAt: { type: Date, default: null },
  courierCompany: { type: String, default: '' },
  destinationState: { type: String, default: '' },
  calculatedCourierCost: { type: Number, default: null },
  manualCourierCost: { type: Number, default: null },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  recordedByName: { type: String, default: '' },
  notes: { type: String, default: '' },
}, { _id: true, timestamps: true });

const DispatchBatchSchema = new mongoose.Schema({
  batchCode: { type: String, required: true, unique: true },
  courierCompany: { type: String, default: '' },
  pickupDate: Date,
  pickupConfirmedAt: Date,
  notes: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  createdByName: { type: String, default: '' },
  orderIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }],
  orderNumbers: [{ type: String }],
  parcelCount: { type: Number, default: 0 },
  /** Per-parcel history — tracking updates must not overwrite dispatchedAt. */
  parcels: [ParcelRecordSchema],
  status: {
    type: String,
    enum: ['draft', 'pickup_pending', 'pickup_arranged', 'handed_over', 'completed'],
    default: 'pickup_pending',
  },
}, { timestamps: true });

DispatchBatchSchema.index({ 'parcels.dispatchedAt': -1 });
DispatchBatchSchema.index({ 'parcels.trackingNumber': 1 });
DispatchBatchSchema.index({ pickupDate: -1 });

export default mongoose.models.DispatchBatch || mongoose.model('DispatchBatch', DispatchBatchSchema);
