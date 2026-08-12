import mongoose from 'mongoose';

const StateRateSchema = new mongoose.Schema({
  state: { type: String, required: true },
  shippingCost: { type: Number, default: 0 },
  deliveryEstimate: { type: String, default: '' },
}, { _id: false });

const ShippingTemplateSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String, default: '' },
  rates: [StateRateSchema],
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.models.ShippingTemplate || mongoose.model('ShippingTemplate', ShippingTemplateSchema);