export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { resolvePhotoFrame3dAdminPreviewAccess } from '@/lib/photoFrame3dAdminPreview';

/**
 * Boolean live-preview entitlement only. Does not return env values or secrets.
 * Camera AR stays disabled until a future DEVICE-VERIFIED gate.
 */
export async function GET() {
  const access = await resolvePhotoFrame3dAdminPreviewAccess();
  return NextResponse.json(
    {
      adminPreview: access.adminPreview === true,
      cameraAr: false,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
