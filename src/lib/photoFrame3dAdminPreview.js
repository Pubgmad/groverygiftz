import { getServerSession } from 'next-auth';
import { can, getRequestAdminAccess } from '@/lib/adminAccess';
import {
  applyPublicPreview3dVisibility,
  isPhotoFrame3dAdminPreviewFlagEnabled,
} from '@/lib/preview3d';

export { isPhotoFrame3dAdminPreviewFlagEnabled };

/**
 * Server-only access decision for unfinished photo-frame 3D.
 * Never expose the env value or admin credentials to the browser.
 */
export async function resolvePhotoFrame3dAdminPreviewAccess(sessionInput) {
  const flagEnabled = isPhotoFrame3dAdminPreviewFlagEnabled();
  const result = {
    flagEnabled,
    adminPreview: false,
    cameraAr: false,
    authorizedAdmin: false,
  };

  let session = sessionInput;
  if (session === undefined) {
    const { authOptions } = await import('@/lib/auth');
    session = await getServerSession(authOptions);
  }
  if (!session?.user || session.user.type !== 'admin') return result;

  const access = await getRequestAdminAccess(session);
  result.authorizedAdmin = !!(access?.ok && can(access, 'products', 'read'));
  result.adminPreview = result.authorizedAdmin && flagEnabled;
  return result;
}

export function presentProductPreview3d(product, access) {
  return applyPublicPreview3dVisibility(product, access);
}
