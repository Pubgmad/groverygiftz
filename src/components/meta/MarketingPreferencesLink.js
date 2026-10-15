'use client';

import { META_PREFERENCES_EVENT } from '@/lib/metaAttribution';

export default function MarketingPreferencesLink() {
  return <button type="button" className="text-left hover:text-accent-400 transition-colors" onClick={() => window.dispatchEvent(new Event(META_PREFERENCES_EVENT))}>Cookie preferences</button>;
}
