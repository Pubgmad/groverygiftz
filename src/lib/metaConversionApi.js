import crypto from 'crypto';
import Settings from '@/models/Settings';
import Order from '@/models/Order';

const META_GRAPH_VERSION = 'v20.0';

const clean = (value) => String(value || '').trim();
const normalizeLower = (value) => clean(value).toLowerCase();
const digitsOnly = (value) => clean(value).replace(/\D/g, '');
const sha256 = (value) => {
  const normalized = clean(value);
  if (!normalized) return undefined;
  return crypto.createHash('sha256').update(normalized).digest('hex');
};

const splitName = (fullName = '') => {
  const parts = clean(fullName).toLowerCase().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] || '', lastName: parts.length > 1 ? parts[parts.length - 1] : '' };
};

const contentForItem = (item) => ({
  id: String(item.product || item.productId || item._id || item.title || ''),
  quantity: Number(item.quantity || 1),
  item_price: Number(item.price || 0),
});

function buildPurchasePayload(order, settings) {
  const address = order.shippingAddress || {};
  const { firstName, lastName } = splitName(address.fullName);
  const email = normalizeLower(address.email || order.guestEmail);
  const phone = digitsOnly(address.whatsappNumber || address.phone);
  const eventId = order.metaConversionPurchaseEventId || `purchase-${order.orderNumber}`;
  const contents = (order.items || []).map(contentForItem).filter((item) => item.id);

  const userData = {
    em: sha256(email),
    ph: sha256(phone),
    fn: sha256(firstName),
    ln: sha256(lastName),
    ct: sha256(normalizeLower(address.city)),
    st: sha256(normalizeLower(address.state)),
    zp: sha256(clean(address.pincode)),
    country: sha256('in'),
    external_id: sha256(String(order.customer || email || order._id || '')),
  };
  Object.keys(userData).forEach((key) => userData[key] === undefined && delete userData[key]);

  const customData = {
    currency: 'INR',
    value: Number(order.total || 0),
    order_id: order.orderNumber,
    content_type: 'product',
    content_ids: contents.map((item) => item.id),
    contents,
    num_items: contents.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
  };

  const event = {
    event_name: 'Purchase',
    event_time: Math.floor(new Date(order.paidAt || order.updatedAt || Date.now()).getTime() / 1000),
    event_id: eventId,
    action_source: 'website',
    event_source_url: process.env.NEXTAUTH_URL || 'https://groverygiftz.in',
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

  const order = await Order.findOneAndUpdate(
    {
      _id: orderId,
      paymentStatus: 'paid',
      metaConversionPurchaseSentAt: { $exists: false },
      metaConversionPurchaseStartedAt: { $exists: false },
    },
    {
      $set: {
        metaConversionPurchaseStartedAt: new Date(),
        metaConversionPurchaseEventId: '',
        metaConversionPurchaseError: '',
      },
    },
    { new: true }
  );

  if (!order) return { skipped: true };

  try {
    if (!order.metaConversionPurchaseEventId && order.orderNumber) order.metaConversionPurchaseEventId = `purchase-${order.orderNumber}`;
    const { payload, eventId } = buildPurchasePayload(order, settings);
    const res = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${encodeURIComponent(settings.metaPixelId)}/events?access_token=${encodeURIComponent(settings.metaConversionApiAccessToken)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error?.message || 'Meta Conversion API request failed');

    await Order.updateOne(
      { _id: order._id },
      { $set: { metaConversionPurchaseSentAt: new Date(), metaConversionPurchaseEventId: eventId, metaConversionPurchaseError: '' }, $unset: { metaConversionPurchaseStartedAt: '' } }
    );
    return { sent: true, eventId };
  } catch (error) {
    await Order.updateOne(
      { _id: order._id },
      { $set: { metaConversionPurchaseError: error.message || 'Meta Conversion API request failed' }, $unset: { metaConversionPurchaseStartedAt: '' } }
    );
    console.error('Meta Conversion API purchase error:', error);
    return { sent: false, error: error.message };
  }
}