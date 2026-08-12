import mongoose from 'mongoose';

const OrderSchema = new mongoose.Schema({
  orderNumber: { type: String, required: true, unique: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  guestEmail: String,
  items: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    title: String,
    image: String,
    price: Number,
    quantity: Number,
    variant: String,
    customFields: mongoose.Schema.Types.Mixed,
    collageUploads: mongoose.Schema.Types.Mixed,
    giftWrap: Boolean,
    giftMessage: String,
    customizationPreview: mongoose.Schema.Types.Mixed,
  }],
  shippingAddress: {
    fullName: String,
    phone: String,
    whatsappNumber: String,
    email: String,
    line1: String,
    line2: String,
    city: String,
    state: String,
    pincode: String,
  },
  subtotal: Number,
  shippingCost: Number,
  total: Number,
  deliveryEstimate: String,
  isOutOfTamilNadu: { type: Boolean, default: false },
  paidAt: Date,
  status: { type: String, enum: ['ordered', 'on_process', 'dispatched', 'cancelled', 'pending', 'processing', 'shipped', 'delivered'], default: 'ordered' },
  paymentStatus: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
  paymentMethod: { type: String, default: 'Cashfree' },
  cashfreeOrderId: String,
  cashfreeCfOrderId: String,
  cashfreePaymentSessionId: String,
  cashfreePaymentId: String,
  trackingNumber: String,
  notes: String,
}, { timestamps: true });

export default mongoose.models.Order || mongoose.model('Order', OrderSchema);

