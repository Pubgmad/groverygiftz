import { formatLongIstDate } from '@/lib/businessCalendar';
import { formatPrice } from '@/lib/utils';
import { confirmationRecipientEmail } from '@/lib/orderConfirmationSchedule';

export const ORDER_CONFIRMATION_TEMPLATE_VERSION = 'order-confirmation-v1';
const LOGO_URL = 'https://www.groverygiftz.in/media/uploads/1786613102578-9xp158-Grovery.png';
const SITE_URL = 'https://www.groverygiftz.in';

export function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function itemLines(order) {
  return (Array.isArray(order?.items) ? order.items : []).map((item) => {
    const quantity = Math.max(1, Number(item?.quantity || 1));
    const unit = Number(item?.price || 0);
    const variant = String(item?.variant || '').trim();
    return {
      title: String(item?.title || 'Custom gift').trim() || 'Custom gift',
      quantity,
      variant,
      lineTotal: unit * quantity,
    };
  });
}

export function buildOrderConfirmationEmail(order = {}) {
  const schedule = order.confirmationSchedule || {};
  const customerName = String(order?.shippingAddress?.fullName || 'Customer').trim() || 'Customer';
  const orderNumber = String(order?.orderNumber || '').trim();
  const readyDate = formatLongIstDate(schedule.expectedReadyDateIst);
  const deliveryDate = formatLongIstDate(schedule.estimatedDeliveryDateIst);
  const to = confirmationRecipientEmail(order);
  const items = itemLines(order);
  if (!to || !orderNumber || !readyDate || !deliveryDate || !items.length) {
    return { ok: false, reason: 'incomplete_confirmation_data' };
  }

  const subject = `GroveryGiftz | Order Confirmed — #${orderNumber}`;
  const productText = items.map((item) => {
    const variant = item.variant ? ` (${item.variant})` : '';
    return `${item.title}${variant} × ${item.quantity} — ${formatPrice(item.lineTotal)}`;
  }).join('\n');
  const productHtml = items.map((item) => {
    const variant = item.variant ? `<br><span style="color:#6b7280;font-size:13px">${escapeHtml(item.variant)}</span>` : '';
    return `<tr>
      <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111827">
        <strong style="word-break:break-word">${escapeHtml(item.title)}</strong>${variant}<br>
        <span style="color:#6b7280">Qty ${item.quantity}</span>
      </td>
      <td style="padding:10px 0 10px 12px;border-bottom:1px solid #e5e7eb;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#2456D8;font-weight:700;white-space:nowrap;text-align:right">${escapeHtml(formatPrice(item.lineTotal))}</td>
    </tr>`;
  }).join('');

  const text = [
    `Hello ${customerName}!`,
    '',
    'Thank you for choosing GroveryGiftz!',
    '',
    'We\'re pleased to inform you that your order has been successfully confirmed.',
    '',
    'ORDER CONFIRMATION',
    `Order ID: #${orderNumber}`,
    'Product:',
    productText,
    `Expected Ready Date: ${readyDate}`,
    `Estimated Delivery Date: ${deliveryDate}`,
    '',
    'What\'s Next?',
    'Our team will now begin preparing your personalized order with care and attention to detail. Once your product is ready, it will be carefully packed and dispatched for delivery.',
    '',
    'We appreciate your trust in GroveryGiftz and look forward to making your special moments even more memorable!',
    '',
    'Thank you for shopping with us.',
    '',
    'Warm regards,',
    'Team GroveryGiftz',
    SITE_URL.replace('https://', ''),
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:16px 0">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb">
          <tr>
            <td style="background:linear-gradient(90deg,#2456D8,#f97316);height:6px;font-size:0;line-height:0">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:24px 24px 8px;text-align:center">
              <img src="${LOGO_URL}" alt="GroveryGiftz" width="86" style="display:block;margin:0 auto 12px;border:0;width:86px;height:auto">
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#2456D8;font-weight:700">Order confirmed</p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 24px 16px;font-family:Arial,Helvetica,sans-serif;color:#111827">
              <p style="margin:0 0 12px;font-size:16px">Hello <strong>${escapeHtml(customerName)}</strong>! &#128075;</p>
              <p style="margin:0 0 12px;font-size:15px;line-height:1.6">Thank you for choosing <strong>GroveryGiftz!</strong> &#128153;&#129449;</p>
              <p style="margin:0;font-size:15px;line-height:1.6">We're pleased to inform you that your order has been successfully confirmed.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 24px 20px">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #dbeafe;border-radius:12px">
                <tr>
                  <td style="padding:18px 20px;font-family:Arial,Helvetica,sans-serif">
                    <p style="margin:0 0 12px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#2456D8;font-weight:700">Order confirmation</p>
                    <p style="margin:0 0 14px;font-size:15px;color:#111827">&#127991; <strong>Order ID:</strong> #${escapeHtml(orderNumber)}</p>
                    <p style="margin:0 0 8px;font-size:14px;color:#374151">&#127873; <strong>Product</strong></p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${productHtml}</table>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px">
                      <tr>
                        <td style="padding:10px 12px;background:#eff6ff;border-radius:8px;font-family:Arial,Helvetica,sans-serif">
                          <p style="margin:0 0 4px;font-size:12px;color:#1d4ed8">&#128197; Expected Ready Date</p>
                          <p style="margin:0;font-size:16px;font-weight:700;color:#1e3a8a">${escapeHtml(readyDate)}</p>
                        </td>
                      </tr>
                      <tr><td style="height:8px;font-size:0;line-height:0">&nbsp;</td></tr>
                      <tr>
                        <td style="padding:10px 12px;background:#fff7ed;border-radius:8px;font-family:Arial,Helvetica,sans-serif">
                          <p style="margin:0 0 4px;font-size:12px;color:#c2410c">&#128666; Estimated Delivery Date</p>
                          <p style="margin:0;font-size:16px;font-weight:700;color:#9a3412">${escapeHtml(deliveryDate)}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 24px 24px;font-family:Arial,Helvetica,sans-serif;color:#111827;font-size:15px;line-height:1.6">
              <p style="margin:0 0 8px"><strong>What's Next?</strong></p>
              <p style="margin:0 0 16px">Our team will now begin preparing your personalized order with care and attention to detail. Once your product is ready, it will be carefully packed and dispatched for delivery.</p>
              <p style="margin:0 0 16px">We appreciate your trust in GroveryGiftz and look forward to making your special moments even more memorable!</p>
              <p style="margin:0 0 16px">Thank you for shopping with us.</p>
              <p style="margin:0">Warm regards,<br><strong>Team GroveryGiftz &#128153;&#129449;</strong><br>
              <a href="${SITE_URL}" style="color:#2456D8;text-decoration:none">${SITE_URL.replace('https://', '')}</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return {
    ok: true,
    to,
    subject,
    text,
    html,
    templateVersion: ORDER_CONFIRMATION_TEMPLATE_VERSION,
  };
}
