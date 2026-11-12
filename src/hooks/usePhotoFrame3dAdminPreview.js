'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

/**
 * Live unfinished 3D is allowed only after the server confirms admin + flag.
 * Customers and logged-out visitors never call the access API.
 */
export default function usePhotoFrame3dAdminPreview(serverHint = false) {
  const { data: session, status } = useSession();
  const [adminPreview, setAdminPreview] = useState(!!serverHint);

  useEffect(() => {
    if (status === 'loading') return undefined;
    if (status !== 'authenticated' || session?.user?.type !== 'admin') {
      setAdminPreview(false);
      return undefined;
    }
    let cancelled = false;
    fetch('/api/admin/photo-frame-3d/preview-access', { cache: 'no-store', credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { adminPreview: false }))
      .then((data) => {
        if (!cancelled) setAdminPreview(data?.adminPreview === true);
      })
      .catch(() => {
        if (!cancelled) setAdminPreview(false);
      });
    return () => { cancelled = true; };
  }, [status, session?.user?.type]);

  return adminPreview;
}
