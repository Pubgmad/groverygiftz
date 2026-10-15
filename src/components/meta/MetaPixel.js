import dbConnect from '@/lib/db';
import Settings from '@/models/Settings';
import MetaPixelClient from './MetaPixelClient';
import { cleanupExpiredMetaAttribution } from '@/lib/metaAttributionServer';

export default async function MetaPixel() {
  try {
    await dbConnect();
    await cleanupExpiredMetaAttribution();
    const settings = await Settings.findOne().select('metaPixelEnabled metaPixelId metaPixelTestEventCode metaConversionApiEnabled').lean();

    return (
      <MetaPixelClient
        enabled={!!settings?.metaPixelEnabled}
        trackingEnabled={!!settings?.metaPixelEnabled || !!settings?.metaConversionApiEnabled}
        pixelId={settings?.metaPixelId || ''}
        testEventCode={settings?.metaPixelTestEventCode || ''}
      />
    );
  } catch {
    return null;
  }
}
