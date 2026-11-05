export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import Order from '@/models/Order';
import Product from '@/models/Product';
import Admin from '@/models/Admin';
import { requireAdminPermission, logAdminAudit } from '@/lib/adminAccess';
import { getNextWhatsAppOrderNumber } from '@/lib/orderNumbers';
import { appendTimeline, refreshPaymentTotals } from '@/lib/opsOrderHelpers';
import { snapshotOrderItemCost } from '@/lib/makingCost';
import MakingCost from '@/models/MakingCost';
import { assertStockAvailable, getGroupedStockRequests, loadProductsByOrderItems, deductOrderInventory } from '@/lib/inventory';

function digitsPhone(value = '') {
  return String(value || '').replace(/\D/g, '');
}

/** Indian mobile: 10 digits starting 6–9 (strip +91 / leading 0). */
function normalizeIndianMobile(value = '') {
  let d = digitsPhone(value);
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  if (d.length !== 10 || !/^[6-9]/.test(d)) return '';
  return d;
}

function normalizeItem(bodyItem = {}, product, { useCatalogPrice = true } = {}) {
  const quantity = Math.max(1, Number(bodyItem.quantity) || 1);
  let unit = 0;
  if (useCatalogPrice) {
    const price = Number(bodyItem.price);
    unit = Number.isFinite(price) && price >= 0
      ? price
      : Number(product?.salePrice > 0 ? product.salePrice : product?.regularPrice) || 0;
  }
  // Manual WhatsApp combo: never store catalog/body unit prices on line items
  return {
    product: product?._id,
    title: product?.title || bodyItem.title || 'Product',
    image: product?.images?.[0] || bodyItem.image || '',
    price: unit,
    quantity,
    variant: String(bodyItem.variant || '').trim(),
    customFields: bodyItem.customFields || undefined,
    collageUploads: bodyItem.collageUploads || undefined,
    customizationPreview: bodyItem.customizationPreview || undefined,
    customizationInstructions: String(bodyItem.customizationInstructions || bodyItem.instructions || '').trim(),
  };
}

export async function POST(req) {
  const { error, access } = await requireAdminPermission('orders', 'write');
  if (error) return error;

  let body;
  let paymentScreenshotFile = null;
  const contentType = req.headers.get('content-type') || '';
  try {
    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const rawPayload = form.get('payload');
      body = JSON.parse(String(rawPayload || '{}'));
      const shot = form.get('paymentScreenshot');
      if (shot && typeof shot !== 'string' && shot.size) paymentScreenshotFile = shot;
    } else {
      body = await req.json();
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const source = String(body.orderSource || 'whatsapp').toLowerCase();
  if (!['whatsapp', 'instagram'].includes(source)) {
    return NextResponse.json({ error: 'orderSource must be whatsapp or instagram' }, { status: 400 });
  }

  const fullName = String(body.customerName || body.shippingAddress?.fullName || '').trim();
  const phone = normalizeIndianMobile(body.phone || body.shippingAddress?.phone);
  const whatsappNumber = normalizeIndianMobile(body.whatsappNumber || body.shippingAddress?.whatsappNumber) || phone;
  const line1 = String(body.line1 || body.shippingAddress?.line1 || '').trim();
  const city = String(body.city || body.shippingAddress?.city || '').trim();
  const state = String(body.state || body.shippingAddress?.state || '').trim();
  const pincode = String(body.pincode || body.shippingAddress?.pincode || '').replace(/\D/g, '');
  const district = String(body.district || body.shippingAddress?.district || '').trim();
  const landmark = String(body.landmark || body.shippingAddress?.landmark || '').trim();
  const line2 = String(body.line2 || body.shippingAddress?.line2 || '').trim();

  if (!fullName) return NextResponse.json({ error: 'Customer name is required' }, { status: 400 });
  if (!phone) return NextResponse.json({ error: 'Valid 10-digit phone number is required' }, { status: 400 });
  if (!line1 || !city || !state || pincode.length !== 6) {
    return NextResponse.json({ error: 'Complete delivery address with city, state, and 6-digit pincode is required' }, { status: 400 });
  }

  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (!rawItems.length) return NextResponse.json({ error: 'At least one product is required' }, { status: 400 });

  await dbConnect();

  const productIds = rawItems
    .map((item) => item.productId || item.product)
    .filter((id) => mongoose.Types.ObjectId.isValid(String(id)));
  const products = await Product.find({ _id: { $in: productIds } }).lean();
  const productsById = Object.fromEntries(products.map((p) => [String(p._id), p]));

  /**
   * WhatsApp/Instagram customized combo: Sales enters overall price manually.
   * Do not auto-calculate from website catalog unit prices.
   */
  const isManualChannel = source === 'whatsapp' || source === 'instagram';
  const rawManualCombo = body.manualComboPrice;
  const hasExplicitManualCombo = rawManualCombo !== undefined
    && rawManualCombo !== null
    && String(rawManualCombo).trim() !== '';
  // WhatsApp/Instagram customized combos MUST use manual overall price — never catalog fallback
  const manualPriceEntered = isManualChannel
    || body.manualPriceEntered === true
    || body.manualPriceEntered === 'true'
    || hasExplicitManualCombo;
  const manualComboPrice = hasExplicitManualCombo ? Number(rawManualCombo) : NaN;
  if (isManualChannel && (!Number.isFinite(manualComboPrice) || manualComboPrice < 0)) {
    return NextResponse.json({
      error: 'Manual overall combo / order price is required for WhatsApp / Instagram orders',
    }, { status: 400 });
  }

  const orderItems = [];
  for (const raw of rawItems) {
    const pid = String(raw.productId || raw.product || '');
    const product = productsById[pid];
    if (!product) return NextResponse.json({ error: `Product not found: ${pid}` }, { status: 400 });
    orderItems.push(normalizeItem(raw, product, { useCatalogPrice: !manualPriceEntered }));
  }

  const costs = await MakingCost.find({ product: { $in: productIds } }).lean().catch(() => []);
  const costsByProduct = {};
  (costs || []).forEach((row) => {
    const key = String(row.product);
    if (!costsByProduct[key]) costsByProduct[key] = [];
    costsByProduct[key].push(row);
  });
  const itemsWithCost = orderItems.map((item) => {
    const product = productsById[String(item.product)];
    const snapshot = snapshotOrderItemCost(item, product, costsByProduct[String(item.product)] || []);
    return { ...item, ...snapshot };
  });

  const shippingCost = Math.max(0, Number(body.shippingCost) || 0);
  // Kept in additionalCharges only — refreshPaymentTotals does owed = total + additionalCharges
  const otherCharges = Math.max(0, Number(body.otherCharges || body.additionalCharges) || 0);
  let subtotal;
  let total;
  if (manualPriceEntered) {
    if (!Number.isFinite(manualComboPrice) || manualComboPrice < 0) {
      return NextResponse.json({ error: 'Manual overall combo / order price is required for WhatsApp customized pricing' }, { status: 400 });
    }
    subtotal = manualComboPrice;
    // Prefer explicit total only if staff sent one that already includes shipping; otherwise compute.
    // Do NOT bake otherCharges into total — that would double-count with additionalCharges.
    if (Number.isFinite(Number(body.total)) && Number(body.total) >= 0 && body.totalIncludesShipping === true) {
      total = Number(body.total);
    } else {
      total = manualComboPrice + shippingCost;
    }
  } else {
    subtotal = itemsWithCost.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1), 0);
    total = Number.isFinite(Number(body.total)) && Number(body.total) >= 0
      ? Number(body.total)
      : subtotal + shippingCost;
  }
  const advancePaid = Math.max(0, Number(body.advancePayment ?? body.advancePaid) || 0);
  const orderOwed = total + otherCharges;
  if (advancePaid > orderOwed + 0.01) {
    return NextResponse.json({ error: 'Advance payment cannot exceed total amount' }, { status: 400 });
  }

  const previewRequired = !(body.previewRequired === false || body.previewRequired === 'no' || body.previewRequired === 'No');
  // Stock may be deducted only when advance is verified and covers the amount owed
  const advanceVerified = Boolean(body.paymentVerified === true);
  const markPaid = advanceVerified && advancePaid >= orderOwed && orderOwed > 0;
  const deductStock = markPaid || body.deductInventory === true;

  if (deductStock) {
    try {
      const byId = await loadProductsByOrderItems(itemsWithCost);
      assertStockAvailable(getGroupedStockRequests(itemsWithCost, byId));
    } catch (error) {
      return NextResponse.json({ error: error.message || 'Insufficient stock' }, { status: 409 });
    }
  }

  let assignedTo = null;
  let assignedToName = '';
  if (body.assignedTo) {
    if (!mongoose.Types.ObjectId.isValid(String(body.assignedTo))) {
      return NextResponse.json({ error: 'Invalid assigned staff' }, { status: 400 });
    }
    const admin = await Admin.findById(body.assignedTo).select('name email isActive').lean();
    if (!admin || admin.isActive === false) {
      return NextResponse.json({ error: 'Assigned staff not found or inactive' }, { status: 400 });
    }
    assignedTo = admin._id;
    assignedToName = admin.name || admin.email || '';
  }

  const orderNumber = await getNextWhatsAppOrderNumber();
  let expectedDispatchDate = null;
  if (body.expectedDispatchDate) {
    const rawExpected = String(body.expectedDispatchDate).trim();
    expectedDispatchDate = /^\d{4}-\d{2}-\d{2}$/.test(rawExpected)
      ? new Date(`${rawExpected}T00:00:00.000+05:30`)
      : new Date(rawExpected);
  }

  const order = new Order({
    orderNumber,
    orderSource: source,
    items: itemsWithCost,
    shippingAddress: {
      fullName,
      phone,
      whatsappNumber,
      email: String(body.email || body.shippingAddress?.email || '').trim(),
      line1,
      line2,
      landmark,
      district,
      city,
      state,
      pincode,
    },
    subtotal,
    shippingCost,
    additionalCharges: otherCharges > 0 ? otherCharges : 0,
    total,
    manualPriceEntered: Boolean(manualPriceEntered),
    manualComboPrice: manualPriceEntered ? manualComboPrice : null,
    paymentMethod: String(body.paymentMethod || 'WhatsApp').trim() || 'WhatsApp',
    paymentStatus: 'pending',
    status: 'ordered',
    opsStatus: 'new_order',
    orderPriority: String(body.orderPriority || '').toLowerCase() === 'urgent' ? 'urgent' : 'normal',
    previewRequired,
    expectedDispatchDate: expectedDispatchDate && !Number.isNaN(expectedDispatchDate.getTime()) ? expectedDispatchDate : undefined,
    internalNotes: String(body.internalNotes || '').trim(),
    notes: String(body.notes || '').trim(),
    createdByAdmin: access.adminId,
    assignedTo: assignedTo || undefined,
    assignedToName,
    designApprovalStatus: 'not_uploaded',
    advancePaid: 0,
    balancePaid: 0,
    paymentRecords: [],
    customerKind: ['new', 'existing_whatsapp'].includes(String(body.customerKind || ''))
      ? String(body.customerKind)
      : '',
    historicalWhatsAppOrderRef: String(body.historicalWhatsAppOrderRef || body.historicalOrderId || '').trim(),
  });

  let paymentPaidAt = null;
  if (advancePaid > 0) {
    const rawPaid = body.paymentDate || body.paidAt;
    if (!rawPaid) {
      return NextResponse.json({ error: 'Actual payment date/time is required when recording advance' }, { status: 400 });
    }
    paymentPaidAt = new Date(rawPaid);
    if (Number.isNaN(paymentPaidAt.getTime())) {
      return NextResponse.json({ error: 'Invalid payment date/time' }, { status: 400 });
    }
    if (!paymentScreenshotFile) {
      return NextResponse.json({
        error: 'Advance payment screenshot is required before creating this WhatsApp order',
      }, { status: 400 });
    }
    const { saveUploadFile } = await import('@/lib/uploadStorage');
    const savedShot = await saveUploadFile(paymentScreenshotFile, 'payment-proofs');
    order.paymentRecords.push({
      kind: 'advance',
      amount: advancePaid,
      method: String(body.paymentMethod || 'WhatsApp').trim(),
      reference: String(body.paymentReference || '').trim(),
      screenshotPath: savedShot.relativePath,
      screenshotUrl: savedShot.url,
      paidAt: paymentPaidAt,
      verified: advanceVerified,
      verifiedBy: advanceVerified ? access.adminId : undefined,
      verifiedAt: advanceVerified ? new Date() : undefined,
      recordedBy: access.adminId,
      recordedByName: access.name || access.email || '',
      notes: String(body.paymentNotes || '').trim(),
    });
  }
  refreshPaymentTotals(order);
  // Prefer the actual payment receipt time over "now" when the order becomes fully paid
  if (order.paymentStatus === 'paid' && paymentPaidAt) {
    order.paidAt = paymentPaidAt;
  }

  appendTimeline(order, {
    type: 'order_created',
    newStatus: 'new_order',
    employee: access.adminId,
    employeeName: access.name || access.email || '',
    notes: `${source} order created`,
  });

  // Automatic Editor assignment when Sales did not pick someone (or Super Admin left blank)
  let assignmentWarning = '';
  if (!order.assignedTo) {
    const { autoAssignEditorIfNeeded } = await import('@/lib/editorAssignment');
    const result = await autoAssignEditorIfNeeded(order, {
      source: `${source}_create`,
      actorId: access.adminId,
      actorName: access.name || access.email || 'Admin',
    });
    if (result.warning) assignmentWarning = result.warning;
  } else if (order.opsStatus === 'new_order') {
    // Manual Editor override still moves workflow into editing
    order.opsStatus = 'editing_in_progress';
    appendTimeline(order, {
      type: 'ops_status',
      previousStatus: 'new_order',
      newStatus: 'editing_in_progress',
      employee: access.adminId,
      employeeName: access.name || access.email || '',
      notes: 'Ops status set to Editing in Progress after manual Editor assignment',
    });
  }

  if (deductStock) {
    order.inventoryDeductionStartedAt = new Date();
    await deductOrderInventory(itemsWithCost);
    order.inventoryDeductedAt = new Date();
  }

  await order.save();

  await logAdminAudit({
    access,
    req,
    action: 'orders.create_whatsapp',
    targetType: 'Order',
    targetId: String(order._id),
    details: { orderNumber, orderSource: source, total, advancePaid, assignedTo: order.assignedTo },
  });

  if (order.assignedTo) {
    const { notifyAssignedEditor } = await import('@/lib/editorAssignment');
    await notifyAssignedEditor(order);
  }

  return NextResponse.json({
    order: {
      _id: order._id,
      orderNumber: order.orderNumber,
      orderSource: order.orderSource,
      paymentStatus: order.paymentStatus,
      balanceStatus: order.balanceStatus,
      remainingBalance: order.remainingBalance,
      opsStatus: order.opsStatus,
      total: order.total,
      assignedTo: order.assignedTo,
      assignedToName: order.assignedToName,
      assignmentWarning: assignmentWarning || undefined,
    },
  }, { status: 201 });
}
