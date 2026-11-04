import Counter from '@/models/Counter';

/** Website paid orders — never share this counter with WhatsApp. */
export async function getNextPaidOrderNumber() {
  const counter = await Counter.findOneAndUpdate(
    { key: 'paidOrder' },
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );
  return `GG${String(counter.seq).padStart(4, '0')}`;
}

/**
 * WhatsApp / offline ops orders — independent sequence (G4746…).
 * Seeds from WHATSAPP_ORDER_SEQ_START (default 4745) so the first ID is G4746
 * when the counter does not exist yet. Never restarts at G0001.
 */
export async function getNextWhatsAppOrderNumber() {
  const seed = Math.max(0, Number(process.env.WHATSAPP_ORDER_SEQ_START || 4745) || 4745);
  // Atomic upsert: on first insert seq becomes seed+1 (first ID G4746 when seed=4745).
  const counter = await Counter.findOneAndUpdate(
    { key: 'whatsappOrder' },
    [
      {
        $set: {
          seq: {
            $add: [
              { $ifNull: ['$seq', seed] },
              1,
            ],
          },
        },
      },
    ],
    { new: true, upsert: true },
  );
  const seq = Math.max(Number(counter?.seq) || 0, 1);
  return `G${String(seq).padStart(4, '0')}`;
}

export function isWebsiteFinalOrderNumber(orderNumber) {
  return /^GG\d{4,}$/.test(String(orderNumber || ''));
}

export function isWhatsAppOrderNumber(orderNumber) {
  return /^G\d{4,}$/.test(String(orderNumber || '')) && !isWebsiteFinalOrderNumber(orderNumber);
}

/** Legacy helper used by Cashfree finalization — GG only. */
export function isFinalOrderNumber(orderNumber) {
  return isWebsiteFinalOrderNumber(orderNumber);
}
