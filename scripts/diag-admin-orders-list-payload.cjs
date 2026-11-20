/**
 * Measure Admin Orders list BSON/JSON size with vs without lean projection.
 * READ-ONLY against production DB when MONGODB_URI is set.
 */
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

function loadEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

const LIST_PROJECT = {
  orderNumber: 1,
  orderSource: 1,
  orderPriority: 1,
  status: 1,
  paymentStatus: 1,
  paymentMethod: 1,
  balanceStatus: 1,
  total: 1,
  subtotal: 1,
  shippingCost: 1,
  createdAt: 1,
  updatedAt: 1,
  paidAt: 1,
  opsStatus: 1,
  assignedTo: 1,
  assignedToName: 1,
  expectedDispatchDate: 1,
  previewRequired: 1,
  guestEmail: 1,
  trackingNumber: 1,
  trackingUrl: 1,
  courierCompany: 1,
  dispatchDate: 1,
  pickupStatus: 1,
  isOutOfTamilNadu: 1,
  deliveryEstimate: 1,
  designApprovalStatus: 1,
  'confirmationSchedule.expectedReadyDateIst': 1,
  'confirmationSchedule.estimatedDeliveryDateIst': 1,
  'confirmationSchedule.shippingEstimateLabel': 1,
  'shippingAddress.fullName': 1,
  'shippingAddress.email': 1,
  'shippingAddress.phone': 1,
  'shippingAddress.whatsappNumber': 1,
  'shippingAddress.city': 1,
  'shippingAddress.state': 1,
  'shippingAddress.pincode': 1,
  'shippingAddress.line1': 1,
  'shippingAddress.line2': 1,
};

(async () => {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI missing');
  const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 25000 });
  await client.connect();
  const col = client.db().collection('orders');
  const filter = { paymentStatus: 'paid' };
  const limit = 10;

  const tFull0 = Date.now();
  const full = await col.find(filter).sort({ createdAt: -1 }).limit(limit).toArray();
  const tFull = Date.now() - tFull0;

  const tLean0 = Date.now();
  const lean = await col.find(filter).project(LIST_PROJECT).sort({ createdAt: -1 }).limit(limit).toArray();
  const tLean = Date.now() - tLean0;

  const fullBytes = Buffer.byteLength(JSON.stringify(full), 'utf8');
  const leanBytes = Buffer.byteLength(JSON.stringify(lean), 'utf8');
  const ratio = fullBytes ? (leanBytes / fullBytes) : 0;

  console.log(JSON.stringify({
    sampleLimit: limit,
    fullJsonBytes: fullBytes,
    leanJsonBytes: leanBytes,
    reductionPct: Math.round((1 - ratio) * 1000) / 10,
    fullQueryMs: tFull,
    leanQueryMs: tLean,
    fullAvgBytesPerOrder: Math.round(fullBytes / Math.max(full.length, 1)),
    leanAvgBytesPerOrder: Math.round(leanBytes / Math.max(lean.length, 1)),
  }, null, 2));

  await client.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
