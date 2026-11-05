import mongoose from 'mongoose';

const TimelineEventSchema = new mongoose.Schema({
  type: { type: String, required: true },
  previousStatus: String,
  newStatus: String,
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  employeeName: String,
  notes: String,
  fileRef: String,
  at: { type: Date, default: Date.now },
}, { _id: true });

const DesignVersionSchema = new mongoose.Schema({
  version: { type: Number, required: true },
  sheetNumber: { type: Number, default: 1, min: 1 },
  sheetLabel: { type: String, default: '' },
  linkedItemIndexes: [{ type: Number }],
  linkedLabels: [{ type: String }],
  filePath: String,
  url: String,
  originalUrl: String,
  mimeType: String,
  size: Number,
  width: Number,
  height: Number,
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  uploadedByName: String,
  notes: String,
  uploadedAt: { type: Date, default: Date.now },
}, { _id: true });

const DesignSheetApprovalSchema = new mongoose.Schema({
  sheetNumber: { type: Number, required: true },
  status: {
    type: String,
    enum: ['not_uploaded', 'awaiting_approval', 'changes_requested', 'approved', 'rejected'],
    default: 'awaiting_approval',
  },
  approvedVersion: { type: Number, default: 0 },
  approvedAt: Date,
  source: { type: String, enum: ['customer', 'admin', 'system'], default: 'system' },
}, { _id: false });

const DesignApprovalEventSchema = new mongoose.Schema({
  version: Number,
  sheetNumber: Number,
  status: String,
  at: { type: Date, default: Date.now },
  source: { type: String, enum: ['customer', 'admin', 'system'], default: 'customer' },
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  notes: String,
  customerEvidence: String,
}, { _id: true });

const SalesCommsItemSchema = new mongoose.Schema({
  done: { type: Boolean, default: false },
  at: Date,
  by: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  byName: String,
  note: String,
}, { _id: false });

const PhotoHistorySchema = new mongoose.Schema({
  slotKey: String,
  previousPath: String,
  newPath: String,
  reason: String,
  originalSize: { type: String, default: '' },
  newSize: { type: String, default: '' },
  itemIndex: { type: Number },
  replacedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  replacedByName: { type: String, default: '' },
  replacedAt: { type: Date, default: Date.now },
}, { _id: true });

const PaymentRecordSchema = new mongoose.Schema({
  kind: {
    type: String,
    enum: ['advance', 'balance', 'additional', 'revision', 'other'],
    default: 'advance',
  },
  amount: { type: Number, required: true },
  method: String,
  reference: String,
  screenshotPath: String,
  screenshotUrl: String,
  /** Actual payment date/time as received — never overwritten on later verification. Absent on legacy rows. */
  paidAt: Date,
  verified: { type: Boolean, default: false },
  /** rejected payments never count toward verified collections */
  rejected: { type: Boolean, default: false },
  rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  rejectedAt: Date,
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  verifiedAt: Date,
  notes: String,
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  recordedByName: String,
}, { _id: true, timestamps: true });

const ProductionVideoSchema = new mongoose.Schema({
  filePath: String,
  url: String,
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  uploadedByName: String,
  uploadedAt: { type: Date, default: Date.now },
  notes: String,
}, { _id: true });

const OrderSchema = new mongoose.Schema({
  orderNumber: { type: String, required: true, unique: true },
  orderSource: {
    type: String,
    enum: ['website', 'whatsapp', 'instagram'],
    default: 'website',
    index: true,
  },
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
    customizationInstructions: String,
    makingCost: Number,
    makingCostStatus: { type: String, enum: ['known', 'unknown'] },
    makingCostSource: { type: String, enum: ['snapshot', 'variant', 'product', 'history'] },
  }],
  shippingAddress: {
    fullName: String,
    phone: String,
    whatsappNumber: String,
    email: String,
    line1: String,
    line2: String,
    landmark: String,
    district: String,
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
  status: {
    type: String,
    enum: ['ordered', 'on_process', 'dispatched', 'cancelled', 'pending', 'processing', 'shipped', 'delivered'],
    default: 'ordered',
  },
  paymentStatus: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
  paymentMethod: { type: String, default: 'Cashfree' },
  cashfreeOrderId: String,
  cashfreeCfOrderId: String,
  cashfreePaymentSessionId: String,
  cashfreePaymentId: String,
  inventoryDeductedAt: Date,
  inventoryDeductionStartedAt: Date,
  trackingNumber: String,
  trackingUrl: String,
  courierCompany: String,
  dispatchDate: Date,
  trackingUpdatedAt: Date,
  pickupStatus: {
    type: String,
    enum: ['pickup_pending', 'pickup_arranged', 'handed_over', ''],
    default: '',
  },
  dispatchBatch: { type: mongoose.Schema.Types.ObjectId, ref: 'DispatchBatch' },
  /** Append-only parcel dispatch history on the Order ID (multi-parcel safe). */
  parcelRefs: [{
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'DispatchBatch' },
    parcelId: { type: mongoose.Schema.Types.ObjectId },
    parcelCode: String,
    trackingNumber: { type: String, default: '' },
    dispatchedAt: Date,
    courierCompany: String,
    weightKg: { type: Number, default: null },
    destinationState: { type: String, default: '' },
    courierCharges: { type: Number, default: null },
    calculatedCourierCost: { type: Number, default: null },
    dispatchedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    dispatchedByName: { type: String, default: '' },
    notes: { type: String, default: '' },
    source: { type: String, default: 'order_details' },
  }],
  metaConversionPurchaseEventId: String,
  metaConversionPurchaseSentAt: Date,
  metaConversionPurchaseStartedAt: Date,
  metaConversionPurchaseError: String,
  metaAttribution: {
    type: new mongoose.Schema({
      allowed: Boolean,
      capturedAt: Date,
      expiresAt: Date,
      fbc: String,
      fbp: String,
      clientUserAgent: String,
      clientIpAddress: String,
    }, { _id: false }),
    select: false,
  },
  notes: String,
  internalNotes: String,

  // —— Ops / WhatsApp ——
  createdByAdmin: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', index: true },
  assignedToName: String,
  /** Append-only Editor assignment audit (auto + manual). */
  assignmentHistory: [{
    at: { type: Date, default: Date.now },
    action: { type: String, default: '' },
    previousAssignee: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    previousAssigneeName: { type: String, default: '' },
    newAssignee: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    newAssigneeName: { type: String, default: '' },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    changedByName: { type: String, default: '' },
    source: { type: String, default: '' },
    note: { type: String, default: '' },
  }],
  expectedDispatchDate: { type: Date, index: true },
  /** WhatsApp-only business priority. Website orders stay `normal`. */
  orderPriority: {
    type: String,
    enum: ['normal', 'urgent'],
    default: 'normal',
    index: true,
  },
  previewRequired: { type: Boolean, default: true },
  opsStatus: {
    type: String,
    enum: [
      'new_order',
      'design_pending',
      'editing_in_progress',
      'preview_waiting',
      'revision_required',
      'approved_printing_pending',
      'printing_assigned',
      'printing_in_progress',
      'printing_completed',
      'production_pending',
      'production_in_progress',
      'manufacturing',
      'assembly',
      'finishing',
      'quality_check',
      'packing_pending',
      'ready_to_dispatch',
      'dispatched',
      'tracking_pending',
      'completed',
      'on_hold',
    ],
    default: 'new_order',
    index: true,
  },
  advancePaid: { type: Number, default: 0 },
  balancePaid: { type: Number, default: 0 },
  additionalCharges: { type: Number, default: 0 },
  remainingBalance: { type: Number, default: 0 },
  balanceStatus: {
    type: String,
    enum: ['pending', 'partially_paid', 'fully_paid', 'verification_required'],
    default: 'pending',
  },
  paymentRecords: [PaymentRecordSchema],
  paymentException: { type: Boolean, default: false },
  paymentExceptionBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  paymentExceptionNote: String,

  // —— Design ——
  designVersions: [DesignVersionSchema],
  currentDesignVersion: { type: Number, default: 0 },
  designSheetApprovals: [DesignSheetApprovalSchema],
  designApprovalStatus: {
    type: String,
    enum: ['not_uploaded', 'awaiting_approval', 'changes_requested', 'approved', 'rejected'],
    default: 'not_uploaded',
    index: true,
  },
  designApprovedVersion: { type: Number, default: 0 },
  designApprovedAt: Date,
  designChangeRequest: String,
  designApprovalHistory: [DesignApprovalEventSchema],
  designRevisionCount: { type: Number, default: 0 },
  freeRevisionUsed: { type: Boolean, default: false },
  revisionCharges: { type: Number, default: 0 },
  revisionPaymentVerified: { type: Boolean, default: false },

  /** Manual reference to a historical WhatsApp order ID (may not exist in DB). */
  historicalWhatsAppOrderRef: { type: String, default: '' },
  customerKind: {
    type: String,
    enum: ['new', 'existing_whatsapp', ''],
    default: '',
  },
  /**
   * WhatsApp customized combo / order total was entered manually by Sales
   * (not auto-calculated from website catalog unit prices).
   */
  manualPriceEntered: { type: Boolean, default: false },
  manualComboPrice: { type: Number, default: null },

  photoHistory: [PhotoHistorySchema],
  productionVideos: [ProductionVideoSchema],
  printingAssignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  printingAssignedToName: String,
  printingStartedAt: Date,
  printingCompletedAt: Date,
  productionStartedAt: Date,
  productionCompletedAt: Date,
  packedAt: Date,

  /** Sales WhatsApp communication checklist — opening WA is not delivery proof. */
  salesCommsChecklist: {
    previewShared: { type: SalesCommsItemSchema, default: () => ({}) },
    approvalReceived: { type: SalesCommsItemSchema, default: () => ({}) },
    videoShared: { type: SalesCommsItemSchema, default: () => ({}) },
    balanceRequested: { type: SalesCommsItemSchema, default: () => ({}) },
    dispatchCommunicated: { type: SalesCommsItemSchema, default: () => ({}) },
    trackingShared: { type: SalesCommsItemSchema, default: () => ({}) },
  },

  timeline: [TimelineEventSchema],
}, { timestamps: true });

OrderSchema.index({ paymentStatus: 1, paidAt: -1 });
OrderSchema.index({ paymentStatus: 1, createdAt: -1 });
OrderSchema.index({ customer: 1, paymentStatus: 1, status: 1 });
OrderSchema.index({ orderSource: 1, paymentStatus: 1, paidAt: -1 });
OrderSchema.index({ opsStatus: 1, expectedDispatchDate: 1 });
OrderSchema.index({ assignedTo: 1, opsStatus: 1 });
OrderSchema.index({ 'paymentRecords.paidAt': -1 });
OrderSchema.index({ 'paymentRecords.kind': 1, 'paymentRecords.paidAt': -1 });
OrderSchema.index({ 'parcelRefs.dispatchedAt': -1 });
OrderSchema.index({ dispatchDate: -1 });
OrderSchema.index({ trackingNumber: 1 });

export default mongoose.models.Order || mongoose.model('Order', OrderSchema);
