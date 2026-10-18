import Settings from '@/models/Settings';
import Order from '@/models/Order';
import { buildMetaPurchase } from './metaPurchase';
import { buildMetaBrowserData, buildMetaCustomerData } from './metaCustomerData';

const META_GRAPH_VERSION = 'v26.0';

export function buildPurchasePayload(order, settings) {
  const purchase = buildMetaPurchase(order);
  if (!purchase) throw new Error('Invalid paid order Purchase data');
  const browserData = buildMetaBrowserData(order.metaAttribution);
  if (!browserData) throw new Error('Permitted original browser metadata unavailable or expired');
  const eventId = purchase.eventId;
  const userData = { ...buildMetaCustomerData(order), ...browserData };

  const customData = purchase.params;

  const event = {
    event_name: 'Purchase',
    event_time: purchase.eventTime,
    event_id: eventId,
    action_source: 'website',
    event_source_url: new URL('/checkout/success', process.env.NEXTAUTH_URL || 'https://groverygiftz.in').href,
    user_data: userData,
    custom_data: customData,
  };

  const payload = { data: [event] };
  if (settings.metaPixelTestEventCode) payload.test_event_code = settings.metaPixelTestEventCode;
  return { payload, eventId };
}

export async function sendMetaPurchaseEvent(orderId) {
  const settings = await Settings.findOne().select('metaPixelEnabled metaPixelId metaPixelTestEventCode metaConversionApiEnabled metaConversionApiAccessToken').lean();
  if (!settings?.metaConversionApiEnabled || !settings?.metaPixelId || !settings?.metaConversionApiAccessToken) return { skipped: true };

  const startedAt = new Date();
  const staleStartedAt = new Date(startedAt.getTime() - 5 * 60 * 1000);
  const order = await Order.findOneAndUpdate(
    {
      _id: orderId,
      paymentStatus: 'paid',
      'metaAttribution.allowed': true,
      metaConversionPurchaseSentAt: null,
      $or: [
        { metaConversionPurchaseStartedAt: null },
        { metaConversionPurchaseStartedAt: { $lt: staleStartedAt } },
      ],
    },
    {
      $set: {
        metaConversionPurchaseStartedAt: startedAt,
        metaConversionPurchaseError: '',
      },
    },
    { new: true }
  ).select('+metaAttribution');

  if (!order) {
    const outstanding = await Order.exists({ _id: orderId, paymentStatus: 'paid', 'metaAttribution.allowed': true, metaConversionPurchaseSentAt: null });
    return { skipped: true, retryable: !!outstanding };
  }

  try {
    const { payload, eventId } = buildPurchasePayload(order, settings);
    const claim = { _id: order._id, metaConversionPurchaseStartedAt: startedAt, 'metaAttribution.allowed': true };
    const identitySaved = await Order.updateOne(claim, { $set: { metaConversionPurchaseEventId: eventId } });
    if (!identitySaved.matchedCount) return { skipped: true };
    // A transient retry always carries the same ID and exact same purchase data.
    let accepted = false;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (attempt > 0 && !await Order.exists(claim)) return { skipped: true };
      try {
        const res = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${encodeURIComponent(settings.metaPixelId)}/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, access_token: settings.metaConversionApiAccessToken }),
          signal: AbortSignal.timeout(10000),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.events_received === 1) { accepted = true; break; }
        const retryable = res.status === 429 || res.status >= 500 || data?.error?.is_transient === true;
        if (retryable && attempt === 0) continue;
        const error = new Error(`Meta Purchase was not accepted (HTTP ${res.status}, code ${Number(data?.error?.code) || 0})`);
        error.retryable = retryable || (res.ok && data.events_received !== 1);
        throw error;
      } catch (error) {
        if (attempt === 0 && ['TimeoutError', 'AbortError', 'TypeError'].includes(error.name)) continue;
        throw error;
      }
    }
    if (!accepted) throw new Error('Meta Purchase was not accepted');

    await Order.updateOne(
      claim,
      { $set: { metaConversionPurchaseSentAt: new Date(), metaConversionPurchaseEventId: eventId, metaConversionPurchaseError: '' }, $unset: { metaConversionPurchaseStartedAt: '', metaAttribution: '' } }
    );
    console.info('Meta Purchase accepted', { orderNumber: order.orderNumber, eventId, value: payload.data[0].custom_data.value, currency: payload.data[0].custom_data.currency });
    return { sent: true, eventId };
  } catch (error) {
    await Order.updateOne(
      { _id: order._id, metaConversionPurchaseStartedAt: startedAt },
      { $set: { metaConversionPurchaseError: error.message || 'Meta Conversion API request failed' }, $unset: { metaConversionPurchaseStartedAt: '' } }
    );
    console.error('Meta Purchase failed', { orderNumber: order.orderNumber, error: error.message || 'Tracking request failed' });
    return { sent: false, error: error.message, retryable: error.retryable === true || ['TimeoutError', 'AbortError', 'TypeError'].includes(error.name) };
  }
}
