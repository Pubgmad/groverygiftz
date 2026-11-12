'use client';

import { useSyncExternalStore } from 'react';

const INITIAL_SETTINGS = {
  freeShippingThreshold: 499,
  whatsapp: '919994549781',
  cashfreeEnabled: false,
  tamilNaduShippingCost: 0,
  otherStateShippingCost: 120,
  tamilNaduDeliveryEstimate: '',
  otherStateDeliveryEstimate: '',
  deliveryHolidays: [],
};

/**
 * Module singleton — ProductDetail + CartDrawer + DeliveryEstimateSummary + Checkout
 * previously each spun a 15s no-store /api/settings poll. Concurrent polls +
 * unconditional setState re-renders starved the customer 3D modal under next
 *dev and concurrent Playwright load.
 *
 * Root-cause fix:
 * - one shared fetch across all consumers
 * - skip setState when payload fingerprint unchanged
 * - poll every 60s (was 15s)
 * - pause while 3D/wall modal open (body[data-preview3d-open])
 */
const POLL_MS = 60000;
const listeners = new Set();
let cached = INITIAL_SETTINGS;
let cacheFingerprint = JSON.stringify(INITIAL_SETTINGS);
let inFlight = null;
let pollTimer = null;
let started = false;
let controller = null;

function emit() {
  listeners.forEach((fn) => {
    try { fn(); } catch { /* ignore */ }
  });
}

function normalize(data) {
  return {
    ...INITIAL_SETTINGS,
    ...data,
    freeShippingThreshold: Number(data.freeShippingThreshold ?? 499),
    whatsapp: data.whatsapp || INITIAL_SETTINGS.whatsapp,
    cashfreeEnabled: !!data.cashfreeEnabled,
    tamilNaduShippingCost: Number(data.tamilNaduShippingCost ?? 0),
    otherStateShippingCost: Number(data.otherStateShippingCost ?? data.shippingCost ?? 120),
    tamilNaduDeliveryEstimate: typeof data.tamilNaduDeliveryEstimate === 'string' ? data.tamilNaduDeliveryEstimate : '',
    otherStateDeliveryEstimate: typeof data.otherStateDeliveryEstimate === 'string' ? data.otherStateDeliveryEstimate : '',
    deliveryHolidays: Array.isArray(data.deliveryHolidays) ? data.deliveryHolidays : [],
  };
}

async function refresh() {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return cached;
  if (typeof document !== 'undefined' && document.body?.dataset?.preview3dOpen === '1') return cached;

  if (inFlight) return inFlight;
  controller?.abort();
  controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  inFlight = (async () => {
    try {
      const response = await fetch('/api/settings', {
        cache: 'no-store',
        signal: controller?.signal,
      });
      if (!response.ok) return cached;
      const data = await response.json();
      if (!data || typeof data !== 'object' || Array.isArray(data)) return cached;
      const next = normalize(data);
      const fingerprint = JSON.stringify(next);
      if (fingerprint !== cacheFingerprint) {
        cached = next;
        cacheFingerprint = fingerprint;
        emit();
      }
      return cached;
    } catch {
      return cached;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

function ensureStarted() {
  if (started || typeof window === 'undefined') return;
  started = true;
  refresh();
  const onVisibility = () => {
    if (document.visibilityState === 'visible') refresh();
  };
  const onStorage = (event) => {
    if (event.key === 'gg-delivery-estimates-updated') refresh();
  };
  window.addEventListener('focus', refresh);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('groverygiftz:delivery-estimates', refresh);
  window.addEventListener('storage', onStorage);
  pollTimer = window.setInterval(() => {
    if (document.visibilityState !== 'hidden') refresh();
  }, POLL_MS);
}

function subscribe(listener) {
  ensureStarted();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return cached;
}

function getServerSnapshot() {
  return INITIAL_SETTINGS;
}

export default function useDeliverySettings() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
