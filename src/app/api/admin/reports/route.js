export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Order from '@/models/Order';
import DispatchBatch from '@/models/DispatchBatch';
import { requireAdminPermission } from '@/lib/adminAccess';
import { istDayBounds, istRangeBoundsSafe, todayIstYmd, formatIstDateTime } from '@/lib/istTime';

async function requireReportsRead() {
  let { error, access } = await requireAdminPermission('reports', 'read');
  if (!error) return { access };
  ({ error, access } = await requireAdminPermission('orders', 'read'));
  if (!error) return { access };
  const fallback = await requireAdminPermission('operations', 'read');
  if (fallback.error) return { error: fallback.error };
  return { access: fallback.access };
}

function ymdKeyIst(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  // reuse formatIstDate → dd/mm/yyyy; for grouping use ISO-like IST ymd
  const offset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(d.getTime() + offset);
  return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, '0')}-${String(ist.getUTCDate()).padStart(2, '0')}`;
}

function resolveDateRange(searchParams) {
  const today = todayIstYmd();
  const preset = String(searchParams.get('preset') || '').trim();
  let from = String(searchParams.get('from') || '').trim();
  let to = String(searchParams.get('to') || '').trim();
  const date = String(searchParams.get('date') || '').trim();

  if (preset === 'today') {
    from = today;
    to = today;
  } else if (date) {
    from = date;
    to = date;
  }
  if (!from && !to) {
    from = today;
    to = today;
  }
  const bounds = istRangeBoundsSafe(from || to, to || from);
  return { from: from || to, to: to || from, bounds };
}

export async function GET(req) {
  const gate = await requireReportsRead();
  if (gate.error) return gate.error;

  const { searchParams } = new URL(req.url);
  const type = String(searchParams.get('type') || 'payments').toLowerCase();
  const { from, to, bounds } = resolveDateRange(searchParams);
  if (!bounds) {
    return NextResponse.json({ error: 'Invalid date range (use YYYY-MM-DD)' }, { status: 400 });
  }

  await dbConnect();

  if (type === 'payments') {
    const kindRaw = String(searchParams.get('kind') || '').trim();
    const method = String(searchParams.get('method') || '').trim();
    const staff = String(searchParams.get('staff') || '').trim();
    const verifiedFilter = String(searchParams.get('verified') || '').trim(); // yes|no|''
    let source = String(searchParams.get('source') || '').trim().toLowerCase(); // website|whatsapp|instagram|manual|''
    // Report "Website Cashfree" is a classification, not paymentRecords.kind
    let kind = kindRaw;
    if (kindRaw === 'website_cashfree') {
      source = source || 'website';
      kind = '';
    } else if (['advance', 'balance', 'revision', 'other'].includes(kindRaw) && !source) {
      // WhatsApp manual kinds — exclude website Cashfree from these buckets by default
      source = 'manual';
    }

    const match = {
      'paymentRecords.paidAt': { $gte: bounds.start, $lte: bounds.end, $ne: null, $type: 'date' },
      ...(source === 'website' ? { $or: [{ orderSource: 'website' }, { orderSource: { $exists: false } }, { orderSource: null }] } : {}),
      ...(source === 'whatsapp' || source === 'instagram' ? { orderSource: source } : {}),
      // "manual" = WhatsApp/Instagram only (excludes website Cashfree)
      ...(source === 'manual' ? { orderSource: { $in: ['whatsapp', 'instagram'] } } : {}),
    };
    // Do not invent dates: only records that already have a real paidAt

    const pipeline = [
      { $match: match },
      { $unwind: '$paymentRecords' },
      {
        $match: {
          'paymentRecords.paidAt': { $gte: bounds.start, $lte: bounds.end, $ne: null, $type: 'date' },
          ...(kind ? { 'paymentRecords.kind': kind } : {}),
          ...(method ? { 'paymentRecords.method': new RegExp(`^${method.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } : {}),
          ...(staff ? { 'paymentRecords.recordedByName': new RegExp(staff.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } : {}),
          ...(verifiedFilter === 'yes' ? { 'paymentRecords.verified': true } : {}),
          ...(verifiedFilter === 'no' ? { 'paymentRecords.verified': { $ne: true } } : {}),
        },
      },
      {
        $project: {
          orderId: '$_id',
          orderNumber: 1,
          orderSource: 1,
          customerName: '$shippingAddress.fullName',
          phone: '$shippingAddress.phone',
          assignedToName: 1,
          payment: '$paymentRecords',
        },
      },
      { $sort: { 'payment.paidAt': -1 } },
      { $limit: 5000 },
    ];

    const rows = await Order.aggregate(pipeline);

    // Transitional: legacy website Cashfree paid orders that only have order.paidAt
    // (no paymentRecords). Never invent dates — only include when paidAt already exists.
    let legacyWebsite = [];
    const allowLegacy = (!kind || kind === 'advance')
      && verifiedFilter !== 'no'
      && !staff
      && (!source || source === 'website');
    if (allowLegacy) {
      const legacyFilter = {
        paymentStatus: 'paid',
        paidAt: { $gte: bounds.start, $lte: bounds.end, $ne: null, $type: 'date' },
        $and: [
          {
            $or: [
              { paymentRecords: { $exists: false } },
              { paymentRecords: { $size: 0 } },
              { paymentRecords: null },
            ],
          },
          {
            $or: [
              { orderSource: 'website' },
              { orderSource: { $exists: false } },
              { orderSource: null },
            ],
          },
        ],
      };
      if (method) {
        legacyFilter.paymentMethod = new RegExp(`^${method.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
      }
      legacyWebsite = await Order.find(legacyFilter)
        .select('orderNumber orderSource shippingAddress assignedToName total paidAt paymentMethod cashfreePaymentId cashfreeOrderId')
        .sort({ paidAt: -1 })
        .limit(2000)
        .lean();
    }

    const byDay = {};
    const byMethod = {};
    const byStaff = {};
    const byKind = {};
    let verifiedTotal = 0;
    let unverifiedTotal = 0;
    let verifiedCount = 0;
    let unverifiedCount = 0;

    // Day/method/staff/kind breakdowns use verified amounts only unless explicitly filtering unverified
    const breakdownIncludes = (p) => {
      if (verifiedFilter === 'no') return !p.verified;
      if (verifiedFilter === 'yes') return Boolean(p.verified);
      return Boolean(p.verified);
    };

    const accumulate = (p) => {
      const amount = Number(p.amount) || 0;
      if (p.verified) {
        verifiedTotal += amount;
        verifiedCount += 1;
      } else {
        unverifiedTotal += amount;
        unverifiedCount += 1;
      }
      if (!breakdownIncludes(p)) return;
      const day = ymdKeyIst(p.paidAt);
      if (day) {
        byDay[day] = byDay[day] || { date: day, count: 0, amount: 0 };
        byDay[day].count += 1;
        byDay[day].amount += amount;
      }
      const m = p.method || 'Unknown';
      byMethod[m] = byMethod[m] || { method: m, count: 0, amount: 0 };
      byMethod[m].count += 1;
      byMethod[m].amount += amount;
      const s = p.enteredBy || 'Unknown';
      byStaff[s] = byStaff[s] || { staff: s, count: 0, amount: 0 };
      byStaff[s].count += 1;
      byStaff[s].amount += amount;
      const k = p.kind || 'other';
      byKind[k] = byKind[k] || { kind: k, count: 0, amount: 0 };
      byKind[k].count += 1;
      byKind[k].amount += amount;
    };

    const payments = rows.map((row) => {
      const p = row.payment || {};
      const isWebsite = !row.orderSource || row.orderSource === 'website';
      const mapped = {
        orderId: row.orderId,
        orderNumber: row.orderNumber,
        orderSource: row.orderSource || (isWebsite ? 'website' : ''),
        customerName: row.customerName,
        phone: row.phone,
        salesStaff: row.assignedToName || '',
        paymentId: p._id,
        // Website Cashfree must not appear as WhatsApp "Advance" in reports
        kind: isWebsite ? 'website_cashfree' : p.kind,
        reportKindLabel: isWebsite ? 'Website Cashfree' : (p.kind || 'other'),
        amount: Number(p.amount) || 0,
        method: p.method || '',
        reference: p.reference || '',
        paidAt: p.paidAt,
        paidAtIst: formatIstDateTime(p.paidAt),
        verified: Boolean(p.verified),
        verifiedAtIst: p.verifiedAt ? formatIstDateTime(p.verifiedAt) : '',
        enteredBy: p.recordedByName || (isWebsite ? 'Website checkout' : 'Unknown'),
        proof: p.screenshotUrl || p.screenshotPath || '',
        legacyWebsite: false,
      };
      accumulate(mapped);
      return mapped;
    });

    legacyWebsite.forEach((o) => {
      const mapped = {
        orderId: o._id,
        orderNumber: o.orderNumber,
        orderSource: o.orderSource || 'website',
        customerName: o.shippingAddress?.fullName || '',
        phone: o.shippingAddress?.phone || '',
        salesStaff: o.assignedToName || '',
        paymentId: `legacy-${o._id}`,
        kind: 'website_cashfree',
        reportKindLabel: 'Website Cashfree',
        amount: Number(o.total) || 0,
        method: o.paymentMethod || 'Cashfree',
        reference: o.cashfreePaymentId || o.cashfreeOrderId || '',
        paidAt: o.paidAt,
        paidAtIst: formatIstDateTime(o.paidAt),
        verified: true,
        verifiedAtIst: formatIstDateTime(o.paidAt),
        enteredBy: 'Website checkout',
        proof: '',
        legacyWebsite: true,
      };
      accumulate(mapped);
      payments.push(mapped);
    });

    payments.sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime());
    const LIST_CAP = 2000;
    const truncated = payments.length > LIST_CAP;
    const listed = payments.slice(0, LIST_CAP);

    return NextResponse.json({
      type: 'payments',
      from,
      to,
      truncated,
      matchedCount: payments.length,
      breakdownVerifiedOnly: verifiedFilter !== 'no',
      summary: {
        count: payments.length,
        amount: payments.reduce((s, p) => s + p.amount, 0),
        listedCount: listed.length,
        listedAmount: listed.reduce((s, p) => s + p.amount, 0),
        verifiedCount,
        unverifiedCount,
        verifiedTotal,
        unverifiedTotal,
        legacyWebsiteCount: legacyWebsite.length,
      },
      byDay: Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date)),
      byMethod: Object.values(byMethod),
      byStaff: Object.values(byStaff),
      byKind: Object.values(byKind),
      payments: listed,
    });
  }

  if (type === 'dispatch') {
    const courier = String(searchParams.get('courier') || '').trim();
    const state = String(searchParams.get('state') || '').trim();

    const match = {
      'parcels.dispatchedAt': { $gte: bounds.start, $lte: bounds.end, $ne: null },
    };
    const pipeline = [
      { $match: match },
      { $unwind: '$parcels' },
      {
        $match: {
          'parcels.dispatchedAt': { $gte: bounds.start, $lte: bounds.end, $ne: null, $type: 'date' },
          ...(courier ? { 'parcels.courierCompany': new RegExp(courier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } : {}),
          ...(state ? { 'parcels.destinationState': new RegExp(state.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } : {}),
        },
      },
      { $sort: { 'parcels.dispatchedAt': -1 } },
      { $limit: 2000 },
    ];
    const rows = await DispatchBatch.aggregate(pipeline);
    const byDay = {};
    const byState = {};
    const byCourier = {};
    const uniqueOrderKeys = new Set();

    const parcels = rows.map((row) => {
      const p = row.parcels || {};
      const day = ymdKeyIst(p.dispatchedAt);
      const weight = Number(p.weightKg) || 0;
      const cost = p.manualCourierCost != null && Number.isFinite(Number(p.manualCourierCost))
        ? Number(p.manualCourierCost)
        : (Number(p.calculatedCourierCost) || 0);
      const orderIds = Array.isArray(p.orderIds) ? p.orderIds : [];
      const orderNumbers = p.orderNumbers || [];
      const orderCount = orderIds.length || orderNumbers.length;
      orderIds.forEach((id) => uniqueOrderKeys.add(`id:${String(id)}`));
      if (!orderIds.length) orderNumbers.forEach((n) => uniqueOrderKeys.add(`n:${String(n)}`));
      if (day) {
        byDay[day] = byDay[day] || { date: day, parcels: 0, orderSlots: 0, weightKg: 0, courierCost: 0 };
        byDay[day].parcels += 1;
        byDay[day].orderSlots += orderCount;
        byDay[day].weightKg += weight;
        byDay[day].courierCost += cost;
      }
      const st = p.destinationState || 'Unknown';
      byState[st] = byState[st] || { state: st, parcels: 0, courierCost: 0 };
      byState[st].parcels += 1;
      byState[st].courierCost += cost;
      const co = p.courierCompany || 'Unknown';
      byCourier[co] = byCourier[co] || { courier: co, parcels: 0, courierCost: 0 };
      byCourier[co].parcels += 1;
      byCourier[co].courierCost += cost;

      return {
        batchId: row._id,
        batchCode: row.batchCode,
        parcelId: p._id,
        parcelCode: p.parcelCode,
        orderNumbers,
        orderCount,
        trackingNumber: p.trackingNumber || '',
        weightKg: p.weightKg,
        dispatchedAt: p.dispatchedAt,
        dispatchedAtIst: formatIstDateTime(p.dispatchedAt),
        courierCompany: p.courierCompany || '',
        destinationState: p.destinationState || '',
        calculatedCourierCost: p.calculatedCourierCost,
        manualCourierCost: p.manualCourierCost,
        effectiveCourierCost: cost,
        recordedBy: p.recordedByName || '',
      };
    });

    const truncated = parcels.length >= 2000;
    return NextResponse.json({
      type: 'dispatch',
      from,
      to,
      truncated,
      matchedCount: parcels.length,
      summary: {
        parcels: parcels.length,
        orders: uniqueOrderKeys.size,
        orderSlots: parcels.reduce((s, p) => s + p.orderCount, 0),
        weightKg: parcels.reduce((s, p) => s + (Number(p.weightKg) || 0), 0),
        courierCost: parcels.reduce((s, p) => s + p.effectiveCourierCost, 0),
      },
      byDay: Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date)),
      byState: Object.values(byState),
      byCourier: Object.values(byCourier),
      parcels,
    });
  }

  if (type === 'orders' || type === 'combined') {
    const q = String(searchParams.get('q') || '').trim();
    const orderId = String(searchParams.get('orderId') || '').trim();
    const customer = String(searchParams.get('customer') || '').trim();
    const phone = String(searchParams.get('phone') || '').replace(/\D/g, '');
    const tracking = String(searchParams.get('tracking') || '').trim();
    const courier = String(searchParams.get('courier') || '').trim();
    const sales = String(searchParams.get('sales') || '').trim();
    const editor = String(searchParams.get('editor') || '').trim();
    const source = String(searchParams.get('source') || '').trim();
    const status = String(searchParams.get('status') || '').trim();
    const paymentDate = String(searchParams.get('paymentDate') || '').trim();
    const dispatchDate = String(searchParams.get('dispatchDate') || '').trim();

    const and = [];
    if (orderId) and.push({ orderNumber: new RegExp(orderId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') });
    if (customer) and.push({ 'shippingAddress.fullName': new RegExp(customer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') });
    if (phone) and.push({ 'shippingAddress.phone': new RegExp(phone) });
    if (tracking) {
      const rx = new RegExp(tracking.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      and.push({ $or: [{ trackingNumber: rx }, { 'parcelRefs.trackingNumber': rx }] });
    }
    if (courier) {
      const rx = new RegExp(courier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      and.push({ $or: [{ courierCompany: rx }, { 'parcelRefs.courierCompany': rx }] });
    }
    if (sales) and.push({ assignedToName: new RegExp(sales.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') });
    if (editor) and.push({ printingAssignedToName: new RegExp(editor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') });
    if (source) and.push({ orderSource: source });
    if (status) {
      and.push({ $or: [{ opsStatus: status }, { status }, { balanceStatus: status }] });
    }
    if (paymentDate) {
      const pb = istDayBounds(paymentDate);
      if (!pb) {
        return NextResponse.json({ error: 'Invalid paymentDate (use YYYY-MM-DD)' }, { status: 400 });
      }
      // Include paymentRecords.paidAt and legacy order.paidAt (empty paymentRecords only)
      and.push({
        $or: [
          { 'paymentRecords.paidAt': { $gte: pb.start, $lte: pb.end } },
          {
            $and: [
              { paymentStatus: 'paid' },
              { paidAt: { $gte: pb.start, $lte: pb.end, $type: 'date' } },
              {
                $or: [
                  { paymentRecords: { $exists: false } },
                  { paymentRecords: { $size: 0 } },
                  { paymentRecords: null },
                ],
              },
            ],
          },
        ],
      });
    }
    if (dispatchDate) {
      const dbounds = istDayBounds(dispatchDate);
      if (!dbounds) {
        return NextResponse.json({ error: 'Invalid dispatchDate (use YYYY-MM-DD)' }, { status: 400 });
      }
      // Actual parcel handover dates only — never bare order.dispatchDate
      and.push({ 'parcelRefs.dispatchedAt': { $gte: dbounds.start, $lte: dbounds.end } });
    }
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      and.push({
        $or: [
          { orderNumber: rx },
          { 'shippingAddress.fullName': rx },
          { 'shippingAddress.phone': rx },
          { trackingNumber: rx },
          { 'parcelRefs.trackingNumber': rx },
        ],
      });
    }

    // Always apply From/To IST activity window (actual paidAt / dispatchedAt / legacy paidAt)
    // Specific paymentDate/dispatchDate filters already narrow further above.
    if (!paymentDate && !dispatchDate) {
      and.push({
        $or: [
          { 'paymentRecords.paidAt': { $gte: bounds.start, $lte: bounds.end } },
          { 'parcelRefs.dispatchedAt': { $gte: bounds.start, $lte: bounds.end } },
          {
            $and: [
              { paymentStatus: 'paid' },
              { paidAt: { $gte: bounds.start, $lte: bounds.end, $type: 'date' } },
              {
                $or: [
                  { paymentRecords: { $exists: false } },
                  { paymentRecords: { $size: 0 } },
                  { paymentRecords: null },
                ],
              },
            ],
          },
        ],
      });
    }

    const filter = and.length ? { $and: and } : {};

    // Aggregate so sort-by-activity happens before limit (never limit then sort wrong set)
    const aggregated = await Order.aggregate([
      { $match: filter },
      {
        $addFields: {
          _activityTs: {
            $max: [
              { $max: { $map: { input: { $ifNull: ['$paymentRecords', []] }, as: 'p', in: '$$p.paidAt' } } },
              { $max: { $map: { input: { $ifNull: ['$parcelRefs', []] }, as: 'p', in: '$$p.dispatchedAt' } } },
              {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$paymentStatus', 'paid'] },
                      { $lte: [{ $size: { $ifNull: ['$paymentRecords', []] } }, 0] },
                    ],
                  },
                  '$paidAt',
                  null,
                ],
              },
            ],
          },
        },
      },
      { $sort: { _activityTs: -1 } },
      { $limit: 500 },
      {
        $project: {
          orderNumber: 1,
          orderSource: 1,
          status: 1,
          opsStatus: 1,
          balanceStatus: 1,
          total: 1,
          shippingAddress: 1,
          assignedToName: 1,
          printingAssignedToName: 1,
          paymentRecords: 1,
          parcelRefs: 1,
          trackingNumber: 1,
          courierCompany: 1,
          paidAt: 1,
          paymentStatus: 1,
          paymentMethod: 1,
        },
      },
    ]);
    const limited = aggregated;

    const mapped = limited.map((o) => {
      const recordPayments = (o.paymentRecords || [])
        .filter((p) => p.paidAt)
        .map((p) => ({
          kind: p.kind,
          amount: p.amount,
          paidAtIst: formatIstDateTime(p.paidAt),
          verified: Boolean(p.verified),
          method: p.method || '',
        }));
      // Legacy website row when no paymentRecords but order.paidAt exists
      if (
        !recordPayments.length
        && o.paymentStatus === 'paid'
        && o.paidAt
      ) {
        recordPayments.push({
          kind: 'advance',
          amount: Number(o.total) || 0,
          paidAtIst: formatIstDateTime(o.paidAt),
          verified: true,
          method: o.paymentMethod || 'Cashfree',
          legacyWebsite: true,
        });
      }
      return {
        orderId: o._id,
        orderNumber: o.orderNumber,
        orderSource: o.orderSource,
        status: o.status,
        opsStatus: o.opsStatus,
        balanceStatus: o.balanceStatus,
        total: o.total,
        customerName: o.shippingAddress?.fullName || '',
        phone: o.shippingAddress?.phone || '',
        salesStaff: o.assignedToName || '',
        editor: o.printingAssignedToName || '',
        trackingNumber: o.trackingNumber || '',
        courierCompany: o.courierCompany || '',
        payments: recordPayments,
        parcels: (o.parcelRefs || []).map((p) => ({
          parcelCode: p.parcelCode,
          trackingNumber: p.trackingNumber,
          dispatchedAtIst: p.dispatchedAt ? formatIstDateTime(p.dispatchedAt) : '',
          courierCompany: p.courierCompany || '',
        })),
      };
    });

    return NextResponse.json({
      type: 'orders',
      from,
      to,
      count: mapped.length,
      orders: mapped,
    });
  }

  return NextResponse.json({ error: 'Unknown report type' }, { status: 400 });
}
