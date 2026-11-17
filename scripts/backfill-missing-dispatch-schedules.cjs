/**
 * One-shot: fill confirmationSchedule + expectedDispatchDate for paid orders
 * that never got a Cashfree confirmation snapshot (Admin Dispatch column empty).
 *
 * Usage: node scripts/backfill-missing-dispatch-schedules.cjs [--dry-run]
 */
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { MongoClient, ObjectId } = require('mongodb');

const DRY_RUN = process.argv.includes('--dry-run');

function loadEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env.local');
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

const strip = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
  .replace(/^import[\s\S]*?from ['"][^'"]+['"];\r?\n/gm, '')
  .replace(/export /g, '');

function loadScheduleApi() {
  const calendar = strip('src/lib/businessCalendar.js');
  const central = strip('src/lib/centralDeliveryEstimates.js');
  const schedule = strip('src/lib/orderConfirmationSchedule.js');
  const context = { console, Intl, Date, Number, String, Array, Math, Boolean };
  vm.createContext(context);
  vm.runInContext(
    `${calendar}\n${central}\n${schedule}\nthis.api = { persistOrderConfirmationSchedule, buildOrderConfirmationSchedule };`,
    context,
  );
  return context.api;
}

loadEnvLocal();

(async () => {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI missing');
  const api = loadScheduleApi();
  const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 30000 });
  await client.connect();
  const db = client.db();
  const settingsDoc = await db.collection('settings').findOne({}) || {};
  const settings = {
    tamilNaduDeliveryEstimate: settingsDoc.tamilNaduDeliveryEstimate,
    otherStateDeliveryEstimate: settingsDoc.otherStateDeliveryEstimate,
    deliveryHolidays: settingsDoc.deliveryHolidays || [],
  };

  const missingQuery = {
    paymentStatus: 'paid',
    $or: [
      { confirmationSchedule: { $exists: false } },
      { 'confirmationSchedule.expectedReadyDateIst': { $exists: false } },
      { 'confirmationSchedule.expectedReadyDateIst': null },
      { 'confirmationSchedule.expectedReadyDateIst': '' },
    ],
  };

  const missing = await db.collection('orders').find(missingQuery).project({
    _id: 1,
    orderNumber: 1,
    paidAt: 1,
    createdAt: 1,
    shippingAddress: 1,
    expectedDispatchDate: 1,
    confirmationSchedule: 1,
    deliveryEstimate: 1,
    orderSource: 1,
  }).sort({ paidAt: 1, createdAt: 1 }).toArray();

  console.log('settings_tn', settings.tamilNaduDeliveryEstimate || '(empty)');
  console.log('settings_other', settings.otherStateDeliveryEstimate || '(empty)');
  console.log('missing_paid_orders', missing.length);
  console.log('mode', DRY_RUN ? 'dry-run' : 'write');

  const results = { filled: [], skipped: [], failed: [] };

  for (const order of missing) {
    const orderDoc = {
      paidAt: order.paidAt || order.createdAt,
      createdAt: order.createdAt,
      shippingAddress: order.shippingAddress || {},
      expectedDispatchDate: order.expectedDispatchDate || undefined,
      confirmationSchedule: order.confirmationSchedule || undefined,
      deliveryEstimate: order.deliveryEstimate || '',
    };

    const result = await api.persistOrderConfirmationSchedule(orderDoc, settings, { allowHistorical: true });
    if (!result.ok) {
      results.failed.push({
        orderNumber: order.orderNumber,
        reason: result.reason || 'unknown',
      });
      console.log('FAIL', order.orderNumber, result.reason);
      continue;
    }

    if (!result.persisted && result.reason === 'already_complete') {
      results.skipped.push(order.orderNumber);
      continue;
    }

    const setFields = {
      confirmationSchedule: orderDoc.confirmationSchedule,
    };
    if (orderDoc.expectedDispatchDate) setFields.expectedDispatchDate = orderDoc.expectedDispatchDate;

    if (!DRY_RUN) {
      await db.collection('orders').updateOne(
        { _id: order._id instanceof ObjectId ? order._id : new ObjectId(String(order._id)) },
        { $set: setFields },
      );
    }

    results.filled.push({
      orderNumber: order.orderNumber,
      ready: orderDoc.confirmationSchedule?.expectedReadyDateIst,
      delivery: orderDoc.confirmationSchedule?.estimatedDeliveryDateIst,
      source: order.orderSource || '',
    });
    console.log(
      DRY_RUN ? 'WOULD_FILL' : 'FILLED',
      order.orderNumber,
      orderDoc.confirmationSchedule?.expectedReadyDateIst,
      '->',
      orderDoc.confirmationSchedule?.estimatedDeliveryDateIst,
    );
  }

  // Verify GG0256 + recount
  const gg0256 = await db.collection('orders').findOne(
    { orderNumber: 'GG0256' },
    { projection: { confirmationSchedule: 1, expectedDispatchDate: 1, deliveryEstimate: 1 } },
  );
  const stillMissing = await db.collection('orders').countDocuments(missingQuery);

  console.log(JSON.stringify({
    filled: results.filled.length,
    skipped: results.skipped.length,
    failed: results.failed.length,
    failedDetail: results.failed,
    filledNumbers: results.filled.map((r) => r.orderNumber),
    gg0256: gg0256 ? {
      ready: gg0256.confirmationSchedule?.expectedReadyDateIst || null,
      delivery: gg0256.confirmationSchedule?.estimatedDeliveryDateIst || null,
      expectedDispatchDate: gg0256.expectedDispatchDate || null,
      deliveryEstimate: gg0256.deliveryEstimate || '',
    } : null,
    stillMissingAfter: DRY_RUN ? '(dry-run — not written)' : stillMissing,
  }, null, 2));

  await client.close();
  if (results.failed.length) process.exitCode = 2;
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
