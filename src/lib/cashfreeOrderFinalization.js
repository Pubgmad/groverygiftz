import dbConnect from '@/lib/db';
import Settings from '@/models/Settings';
import Order from '@/models/Order';
import { getNextPaidOrderNumber, isFinalOrderNumber } from '@/lib/orderNumbers';
import { deductOrderInventory } from '@/lib/inventory';
import { getCashfreeConfig } from '@/lib/cashfreeConfig';
import { sendMetaPurchaseEvent } from '@/lib/metaConversionApi';
import { getOrderDeliveryEstimate } from '@/lib/orderDeliveryEstimate';

export const CASHFREE_VERSION = '2025-01-01';

const endpointFor = (environment, orderId) => environment === 'production'
  ? `https://api.cashfree.com/pg/orders/${encodeURIComponent(orderId)}`
  : `https://sandbox.cashfree.com/pg/orders/${encodeURIComponent(orderId)}`;

export class CashfreeFinalizeError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.name = 'CashfreeFinalizeError';
    this.status = status;
  }
}

const getDisplayDeliveryEstimate = (order, settings = {}) => getOrderDeliveryEstimate(order, settings?.deliveryHolidays || []) || order.deliveryEstimate;

const responseForOrder = (order, success, settings = {}) => ({
  success,
  paymentStatus: order.paymentStatus,
  orderNumber: order.orderNumber,
  deliveryEstimate: getDisplayDeliveryEstimate(order, settings),
  shippingCost: order.shippingCost,
  subtotal: order.subtotal,
  total: order.total,
  items: order.items || [],
});

export async function finalizeCashfreeOrder(orderId) {
  await dbConnect();
  const settings = await Settings.findOne().lean();
  const cashfree = getCashfreeConfig(settings);

  if (!orderId) throw new CashfreeFinalizeError('Missing Cashfree order ID', 400);
  if (!cashfree.appId || !cashfree.secretKey) {
    throw new CashfreeFinalizeError('Cashfree payment is not configured yet', 503);
  }

  const cashfreeRes = await fetch(endpointFor(cashfree.environment, orderId), {
    headers: {
      'x-api-version': CASHFREE_VERSION,
      'x-client-id': cashfree.appId,
      'x-client-secret': cashfree.secretKey,
    },
  });
  const data = await cashfreeRes.json().catch(() => ({}));
  if (!cashfreeRes.ok) {
    throw new CashfreeFinalizeError(data.message || 'Unable to verify Cashfree order', cashfreeRes.status);
  }

  const order = await Order.findOne({ cashfreeOrderId: orderId });
  if (!order) throw new CashfreeFinalizeError('Store order not found', 404);

  order.cashfreeCfOrderId = String(data.cf_order_id || order.cashfreeCfOrderId || '');
  const paid = data.order_status === 'PAID';

  if (!paid) {
    order.paymentStatus = 'pending';
    order.status = 'pending';
    order.deliveryEstimate = getDisplayDeliveryEstimate(order, settings);
    await order.save();
    return responseForOrder(order, false, settings);
  }

  if (!order.inventoryDeductedAt) {
    const staleProcessingDate = new Date(Date.now() - 10 * 60 * 1000);
    const claimed = await Order.findOneAndUpdate(
      {
        _id: order._id,
        inventoryDeductedAt: { $exists: false },
        $or: [
          { inventoryDeductionStartedAt: { $exists: false } },
          { inventoryDeductionStartedAt: { $lt: staleProcessingDate } },
        ],
      },
      { $set: { inventoryDeductionStartedAt: new Date(), cashfreeCfOrderId: String(data.cf_order_id || order.cashfreeCfOrderId || '') } },
      { new: true }
    );

    if (!claimed) {
      const currentOrder = await Order.findById(order._id);
      if (!currentOrder?.inventoryDeductedAt) {
        throw new CashfreeFinalizeError('Payment confirmation is already being processed. Please try again.', 409);
      }
      order.inventoryDeductedAt = currentOrder.inventoryDeductedAt;
      order.paymentStatus = currentOrder.paymentStatus;
      order.status = currentOrder.status;
      order.paidAt = currentOrder.paidAt;
      order.orderNumber = currentOrder.orderNumber;
      order.items = currentOrder.items;
      order.subtotal = currentOrder.subtotal;
      order.shippingCost = currentOrder.shippingCost;
      order.total = currentOrder.total;
      order.deliveryEstimate = currentOrder.deliveryEstimate;
    } else {
      try {
        await deductOrderInventory(claimed.items || []);
        claimed.paymentStatus = 'paid';
        claimed.status = 'ordered';
        if (!claimed.paidAt) claimed.paidAt = new Date();
        if (!isFinalOrderNumber(claimed.orderNumber)) {
          claimed.orderNumber = await getNextPaidOrderNumber();
        }
        claimed.inventoryDeductedAt = new Date();
        claimed.inventoryDeductionStartedAt = undefined;
        await claimed.save();
        order.paymentStatus = claimed.paymentStatus;
        order.status = claimed.status;
        order.paidAt = claimed.paidAt;
        order.orderNumber = claimed.orderNumber;
        order.inventoryDeductedAt = claimed.inventoryDeductedAt;
        order.items = claimed.items;
        order.subtotal = claimed.subtotal;
        order.shippingCost = claimed.shippingCost;
        order.total = claimed.total;
        order.deliveryEstimate = claimed.deliveryEstimate;
      } catch (inventoryError) {
        await Order.updateOne(
          { _id: order._id },
          { $unset: { inventoryDeductionStartedAt: '' }, $set: { cashfreeCfOrderId: String(data.cf_order_id || order.cashfreeCfOrderId || '') } }
        );
        if (inventoryError?.name === 'InventoryError') {
          throw new CashfreeFinalizeError(inventoryError.message, inventoryError.status || 409);
        }
        throw inventoryError;
      }
    }
  } else {
    order.paymentStatus = 'paid';
    if (!order.status || order.status === 'pending') order.status = 'ordered';
    if (!order.paidAt) order.paidAt = new Date();
    if (!isFinalOrderNumber(order.orderNumber)) {
      order.orderNumber = await getNextPaidOrderNumber();
    }
    await order.save();
  }

  const displayDeliveryEstimate = getDisplayDeliveryEstimate(order, settings);
  if (displayDeliveryEstimate && order.deliveryEstimate !== displayDeliveryEstimate) {
    order.deliveryEstimate = displayDeliveryEstimate;
    await order.save();
  }

  try {
    await sendMetaPurchaseEvent(order._id);
  } catch (metaError) {
    console.error('Meta Conversion API finalization hook error:', metaError);
  }

  return responseForOrder(order, true, settings);
}
