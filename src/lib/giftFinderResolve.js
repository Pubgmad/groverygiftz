import {
  GIFT_FINDER_OCCASIONS,
  GIFT_FINDER_TYPES,
  OCCASION_KEYWORDS,
  GIFT_TYPE_KEYWORDS,
} from '@/lib/giftFinderConfig';

const DEFAULT_QUICK_PICKS = [
  { label: 'Birthday', occasion: 'birthday', giftType: '' },
  { label: 'Anniversary', occasion: 'anniversary', giftType: '' },
  { label: "Valentine's", occasion: 'valentine', giftType: '' },
  { label: 'Personalized', occasion: '', giftType: 'personalized' },
  { label: 'For Her', occasion: '', giftType: 'for-her' },
  { label: 'Return Gifts', occasion: '', giftType: 'return-gifts' },
];

const DEFAULT_TICKER = [
  '🎁 Free shipping on orders above ₹{{threshold}}',
  '✨ 100% customized & thoughtful gifts',
  '🚚 Fast, reliable delivery pan India',
  '💝 Perfect for every occasion',
  '⭐ Thousands of happy customers',
  '🎀 Handpicked quality you can trust',
];

function splitCsv(s) {
  if (!s || typeof s !== 'string') return [];
  return s.split(/[,|]/).map((x) => x.trim()).filter(Boolean);
}

/** Rows for <select> + quick picks (client-safe JSON). */
export function resolveGiftFinderForUi(settings) {
  const intro = {
    stillConfused: settings?.giftFinderStillConfused?.trim() || 'Still confused?',
    tryLine: settings?.giftFinderTryLine?.trim() || 'Try our Smart Gift Finder',
    description:
      settings?.giftFinderDescription?.trim() ||
      'Pick an occasion and gift style — we search product titles and descriptions so shoppers find the right gift faster.',
  };

  let occasions = settings?.giftFinderOccasions;
  if (!Array.isArray(occasions) || !occasions.length) {
    occasions = GIFT_FINDER_OCCASIONS.map((o) => ({
      value: o.value,
      label: o.label,
      keywords: (OCCASION_KEYWORDS[o.value] || []).join(', '),
    }));
  } else {
    occasions = occasions.map((row) => ({
      value: String(row.value || '').trim().toLowerCase().replace(/\s+/g, '-'),
      label: String(row.label || row.value || '').trim(),
      keywords: String(row.keywords || '').trim(),
    }));
  }

  let types = settings?.giftFinderTypes;
  if (!Array.isArray(types) || !types.length) {
    types = GIFT_FINDER_TYPES.map((t) => ({
      value: t.value,
      label: t.label,
      keywords: (GIFT_TYPE_KEYWORDS[t.value] || []).join(', '),
    }));
  } else {
    types = types.map((row) => ({
      value: String(row.value || '').trim().toLowerCase().replace(/\s+/g, '-'),
      label: String(row.label || row.value || '').trim(),
      keywords: String(row.keywords || '').trim(),
    }));
  }

  let quickPicks = settings?.giftFinderQuickPicks;
  if (!Array.isArray(quickPicks) || !quickPicks.length) {
    quickPicks = DEFAULT_QUICK_PICKS.map((p) => ({ ...p }));
  } else {
    quickPicks = quickPicks.map((p) => ({
      label: String(p.label || '').trim(),
      occasion: String(p.occasion || '').trim(),
      giftType: String(p.giftType || '').trim(),
    }));
  }

  return { intro, occasions, types, quickPicks };
}

/** Keyword maps for /search — merges admin CSV with code defaults per value. */
export function buildSearchKeywordMaps(settings) {
  const resolved = resolveGiftFinderForUi(settings);
  const occasionKeywords = { ...OCCASION_KEYWORDS };
  const giftTypeKeywords = { ...GIFT_TYPE_KEYWORDS };

  for (const row of resolved.occasions) {
    if (!row.value) continue;
    const custom = splitCsv(row.keywords);
    const fallback = OCCASION_KEYWORDS[row.value] || [row.value.replace(/-/g, ' ')];
    occasionKeywords[row.value] = custom.length ? custom : fallback;
  }
  for (const row of resolved.types) {
    if (!row.value) continue;
    const custom = splitCsv(row.keywords);
    const fallback = GIFT_TYPE_KEYWORDS[row.value] || [row.value.replace(/-/g, ' ')];
    giftTypeKeywords[row.value] = custom.length ? custom : fallback;
  }

  return { occasionKeywords, giftTypeKeywords };
}

export function defaultTickerMessages() {
  return [...DEFAULT_TICKER];
}

/** Resolved ticker lines with {{threshold}} replaced. */
export function resolveTickerMessages(settings) {
  const th = String(settings?.freeShippingThreshold ?? 499);
  const raw = Array.isArray(settings?.tickerMessages) && settings.tickerMessages.filter((s) => String(s).trim()).length
    ? settings.tickerMessages.map((s) => String(s).trim())
    : defaultTickerMessages();
  return raw.map((line) => line.replace(/\{\{threshold\}\}/g, th));
}

export function defaultHotspotSpots() {
  return [
    { label: 'Name Ring', href: '/shop', top: '30%', left: '45%' },
    { label: 'Customized Kappu', href: '/shop', top: '55%', left: '60%' },
    { label: 'Gift combo', href: '/shop', top: '42%', left: '28%' },
  ];
}
