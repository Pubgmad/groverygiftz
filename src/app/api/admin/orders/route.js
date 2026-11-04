export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import Order from '@/models/Order';
import Product from '@/models/Product';
import Admin from '@/models/Admin';
import { requireAdminPermission, logAdminAudit } from '@/lib/adminAccess';
import { getNextWhatsAppOrderNumber } from '@/lib/orderNumbers';
import { appendTimeline, refreshPaymentTotals, notifyAdmins } from '@/lib/opsOrderHelpers';
import { snapshotOrderItemCost } from '@/lib/makingCost';
import MakingCost from '@/models/MakingCost';
import { assertStockAvailable, getGroupedStockRequests, loadProductsByOrderItems, deductOrderInventory } from '@/lib/inventory';

function digitsPhone(value = '') {
  return String(value || '').replace(/\D/g, '');
}

function normalizeItem(bodyItem = {}, product) {
  const quantity = Math.max(1, Number(bodyItem.quantity) || 1);
  const price = Number(bodyItem.price);
  const unit = Number.isFinite(price) && price >= 0
    ? price
    : Number(product?.salePrice > 0 ? product.salePrice : product?.regularPrice) || 0;
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
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const source = String(body.orderSource || 'whatsapp').toLowerCase();
  if (!['whatsapp', 'instagram'].includes(source)) {
    return NextResponse.json({ error: 'orderSource must be whatsapp or instagram' }, { status: 400 });
  }

  const fullName = String(body.customerName || body.shippingAddress?.fullName || '').trim();
  const phone = digitsPhone(body.phone || body.shippingAddress?.phone);
  const whatsappNumber = digitsPhone(body.whatsappNumber || body.shippingAddress?.whatsappNumber || phone);
  const line1 = String(body.line1 || body.shippingAddress?.line1 || '').trim();
  const city = String(body.city || body.shippingAddress?.city || '').trim();
  const state = String(body.state || body.shippingAddress?.state || '').trim();
  const pincode = String(body.pincode || body.shippingAddress?.pincode || '').replace(/\D/g, '');
  const district = String(body.district || body.shippingAddress?.district || '').trim();
  const landmark = String(body.landmark || body.shippingAddress?.landmark || '').trim();
  const line2 = String(body.line2 || body.shippingAddress?.line2 || '').trim();

  if (!fullName) return NextResponse.json({ error: 'Customer name is required' }, { status: 400 });
  if (phone.length < 10) return NextResponse.json({ error: 'Valid phone number is required' }, { status: 400 });
  if (!line1 || !city || !state || pincode.length < 6) {
    return NextResponse.json({ error: 'Complete delivery address with city, state, and pincode is required' }, { status: 400 });
  }

  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (!rawItems.length) return NextResponse.json({ error: 'At least one product is required' }, { status: 400 });

  await dbConnect();

  const productIds = rawItems
    .map((item) => item.productId || item.product)
    .filter((id) => mongoose.Types.ObjectId.isValid(String(id)));
  const products = await Product.find({ _id: { $in: productIds } }).lean();
  const productsById = Object.fromEntries(products.map((p) => [String(p._id), p]));

  const orderItems = [];
  for (const raw of rawItems) {
    const pid = String(raw.productId || raw.product || '');
    const product = productsById[pid];
    if (!product) return NextResponse.json({ error: `Product not found: ${pid}` }, { status: 400 });
    orderItems.push(normalizeItem(raw, product));
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

  const subtotal = itemsWithCost.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1), 0);
  const shippingCost = Math.max(0, Number(body.shippingCost) || 0);
  const total = Number.isFinite(Number(body.total)) && Number(body.total) >= 0
    ? Number(body.total)
    : subtotal + shippingCost;
  const advancePaid = Math.max(0, Number(body.advancePayment ?? body.advancePaid) || 0);
  if (advancePaid > total + 0.01) {
    return NextResponse.json({ error: 'Advance payment cannot exceed total amount' }, { status: 400 });
  }

  const previewRequired = !(body.previewRequired === false || body.previewRequired === 'no' || body.previewRequired === 'No');
  const markPaid = advancePaid >= total && total > 0;
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
  if (body.assignedTo && mongoose.Types.ObjectId.isValid(String(body.assignedTo))) {
    const admin = await Admin.findById(body.assignedTo).select('name email isActive').lean();
    if (admin && admin.isActive !== false) {
      assignedTo = admin._id;
      assignedToName = admin.name || admin.email || '';
    }
  }

  const orderNumber = await getNextWhatsAppOrderNumber();
  const expectedDispatchDate = body.expectedDispatchDate ? new Date(body.expectedDispatchDate) : null;

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
    total,
    paymentMethod: String(body.paymentMethod || 'WhatsApp').trim() || 'WhatsApp',
    paymentStatus: markPaid ? 'paid' : 'pending',
    paidAt: markPaid ? new Date() : undefined,
    status: 'ordered',
    opsStatus: 'new_order',
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
  });

  if (advancePaid > 0) {
    order.paymentRecords.push({
      kind: 'advance',
      amount: advancePaid,
      method: String(body.paymentMethod || 'WhatsApp').trim(),
      reference: String(body.paymentReference || '').trim(),
      paidAt: body.paymentDate ? new Date(body.paymentDate) : new Date(),
      verified: Boolean(body.paymentVerified === true),
      verifiedBy: body.paymentVerified === true ? access.adminId : undefined,
      verifiedAt: body.paymentVerified === true ? new Date() : undefined,
      recordedBy: access.adminId,
      notes: String(body.paymentNotes || '').trim(),
    });
  }
  refreshPaymentTotals(order);

  appendTimeline(order, {
    type: 'order_created',
    newStatus: 'new_order',
    employee: access.adminId,
    employeeName: access.name || access.email || '',
    notes: `${source} order created`,
  });

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
    details: { orderNumber, orderSource: source, total, advancePaid },
  });

  if (assignedTo) {
    await notifyAdmins([assignedTo], {
      type: 'order_assigned',
      title: 'New order assigned',
      body: `${orderNumber} assigned to you`,
      order: order._id,
      orderNumber,
    }).catch(() => {});
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
    },
  }, { status: 201 });
}
