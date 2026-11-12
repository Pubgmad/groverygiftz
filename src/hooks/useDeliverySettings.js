'use client';

import { useEffect, useState } from 'react';

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

export default function useDeliverySettings() {
  const [settings, setSettings] = useState(INITIAL_SETTINGS);

  useEffect(() => {
    let active = true;
    let requestId = 0;
    let controller;

    const refresh = async () => {
      const currentRequestId = ++requestId;
      controller?.abort();
      controller = new AbortController();
      try {
        const response = await fetch('/api/settings', { cache: 'no-store', signal: controller.signal });
        if (!response.ok) return;
        const data = await response.json();
        if (!active || currentRequestId !== requestId || !data || typeof data !== 'object' || Array.isArray(data)) return;
        setSettings({
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
        });
      } catch {
        // Keep the last successful settings when a refresh fails or is superseded.
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    const onStorage = (event) => { if (event.key === 'gg-delivery-estimates-updated') refresh(); };

    refresh();
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('groverygiftz:delivery-estimates', refresh);
    window.addEventListener('storage', onStorage);
    const interval = window.setInterval(() => { if (document.visibilityState !== 'hidden') refresh(); }, 15000);

    return () => {
      active = false;
      controller?.abort();
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('groverygiftz:delivery-estimates', refresh);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return settings;
}
