import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Settings from '@/models/Settings';
import Order from '@/models/Order';
import { getNextPaidOrderNumber, isFinalOrderNumber } from '@/lib/orderNumbers';
import { deductOrderInventory } from '@/lib/inventory';

const CASHFREE_VERSION = '2025-01-01';
const endpointFor = (environment, orderId) => environment === 'production'
  ? `https://api.cashfree.com/pg/orders/${encodeURIComponent(orderId)}`
  : `https://sandbox.cashfree.com/pg/orders/${encodeURIComponent(orderId)}`;

export async function POST(req) {
  try {
    await dbConnect();
    const settings = await Settings.findOne().lean();
    const { orderId } = await req.json();
    if (!orderId) return NextResponse.json({ error: 'Missing Cashfree order ID' }, { status: 400 });
    if (!settings?.cashfreeAppId || !settings?.cashfreeSecretKey) {
      return NextResponse.json({ error: 'Cashfree payment is not configured yet' }, { status: 503 });
    }

    const cashfreeRes = await fetch(endpointFor(settings.cashfreeEnvironment, orderId), {
      headers: {
        'x-api-version': CASHFREE_VERSION,
        'x-client-id': settings.cashfreeAppId,
        'x-client-secret': settings.cashfreeSecretKey,
      },
    });
    const data = await cashfreeRes.json();
    if (!cashfreeRes.ok) {
      return NextResponse.json({ error: data.message || 'Unable to verify Cashfree order' }, { status: cashfreeRes.status });
    }

    const paid = data.order_status === 'PAID';
    const order = await Order.findOne({ cashfreeOrderId: orderId });
    if (!order) return NextResponse.json({ error: 'Store order not found' }, { status: 404 });

    order.cashfreeCfOrderId = String(data.cf_order_id || '');

    if (!paid) {
      order.paymentStatus = 'pending';
      order.status = 'pending';
      await order.save();
      return NextResponse.json({
        success: false,
        paymentStatus: order.paymentStatus,
        orderNumber: order.orderNumber,
        deliveryEstimate: order.deliveryEstimate,
        shippingCost: order.shippingCost,
        total: order.total,
      });
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
        { $set: { inventoryDeductionStartedAt: new Date(), cashfreeCfOrderId: String(data.cf_order_id || '') } },
        { new: true }
      );

      if (!claimed) {
        const currentOrder = await Order.findById(order._id);
        if (!currentOrder?.inventoryDeductedAt) {
          return NextResponse.json({ error: 'Payment confirmation is already being processed. Please try again.' }, { status: 409 });
        }
        order.inventoryDeductedAt = currentOrder.inventoryDeductedAt;
        order.paymentStatus = currentOrder.paymentStatus;
        order.status = currentOrder.status;
        order.paidAt = currentOrder.paidAt;
        order.orderNumber = currentOrder.orderNumber;
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
        } catch (inventoryError) {
          await Order.updateOne(
            { _id: order._id },
            { $unset: { inventoryDeductionStartedAt: '' }, $set: { cashfreeCfOrderId: String(data.cf_order_id || '') } }
          );
          if (inventoryError?.name === 'InventoryError') {
            return NextResponse.json({ error: inventoryError.message }, { status: inventoryError.status || 409 });
          }
          throw inventoryError;
        }
      }
    } else {
      order.paymentStatus = 'paid';
      order.status = 'ordered';
      if (!order.paidAt) order.paidAt = new Date();
      if (!isFinalOrderNumber(order.orderNumber)) {
        order.orderNumber = await getNextPaidOrderNumber();
      }
      await order.save();
    }

    return NextResponse.json({
      success: paid,
      paymentStatus: order.paymentStatus,
      orderNumber: order.orderNumber,
      deliveryEstimate: order.deliveryEstimate,
      shippingCost: order.shippingCost,
      total: order.total,
    });
  } catch (error) {
    console.error('Cashfree verify error:', error);
    return NextResponse.json({ error: 'Payment verification failed' }, { status: 500 });
  }
}
