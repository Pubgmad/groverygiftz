import dbConnect from '@/lib/db';
import Settings from '@/models/Settings';
import MetaPixelClient from './MetaPixelClient';

export default async function MetaPixel() {
  try {
    await dbConnect();
    const settings = await Settings.findOne().select('metaPixelEnabled metaPixelId metaPixelTestEventCode').lean();

    return (
      <MetaPixelClient
        enabled={!!settings?.metaPixelEnabled}
        pixelId={settings?.metaPixelId || ''}
        testEventCode={settings?.metaPixelTestEventCode || ''}
      />
    );
  } catch {
    return null;
  }
}