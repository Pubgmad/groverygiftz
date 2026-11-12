/**
 * Mobile AR entry helpers for photo-frame preview.
 * Does not claim Scene Viewer / Quick Look are identical vertical-wall experiences.
 */

export function detectArCapability(userAgent = '') {
  const ua = String(userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : '') || '');
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const hasWebXR = typeof navigator !== 'undefined' && !!navigator.xr;
  return {
    isIOS,
    isAndroid,
    hasWebXR,
    /** Scene Viewer intent may open on many Android Chrome builds — wall plane fidelity varies. */
    sceneViewerLikely: isAndroid,
    /** Quick Look via USDZ — requires a prepared .usdz asset (not auto-generated here). */
    quickLookReady: false,
    /** Honest label for UI. */
    mode: isAndroid ? 'android_scene_viewer_candidate' : isIOS ? 'ios_quicklook_needs_usdz' : hasWebXR ? 'webxr_candidate' : 'unsupported',
  };
}

/**
 * Build an Android Scene Viewer intent URL for a publicly reachable HTTPS GLB.
 * Localhost / blob URLs will not work on a physical phone.
 */
export function buildAndroidSceneViewerIntent({
  modelUrl,
  title = 'Photo frame preview',
  photoBaked = false,
} = {}) {
  if (!photoBaked) {
    return {
      ok: false,
      reason: 'Camera AR is not launched with the catalog model. Your approved photo is not baked into a public HTTPS GLB yet — use View on Wall or place the frame on a photo of your wall.',
      intentUrl: '',
      fallbackMode: 'wall_photo',
    };
  }
  const absolute = toAbsoluteUrl(modelUrl);
  if (!absolute || !/^https:\/\//i.test(absolute)) {
    return {
      ok: false,
      reason: 'Scene Viewer requires a publicly reachable https:// model URL with your photo baked in (not localhost or blob).',
      intentUrl: '',
      fallbackMode: 'wall_photo',
    };
  }
  const params = new URLSearchParams({
    file: absolute,
    mode: 'ar_preferred',
    title: String(title || 'Photo frame'),
  });
  return {
    ok: true,
    reason: '',
    intentUrl: `intent://arvr.google.com/scene-viewer/1.0?${params.toString()}#Intent;scheme=https;package=com.google.ar.core;action=android.intent.action.VIEW;S.browser_fallback_url=${encodeURIComponent(absolute)};end;`,
    fallbackMode: 'wall_preview',
  };
}

export function toAbsoluteUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (typeof window === 'undefined') return raw;
  try {
    return new URL(raw, window.location.origin).toString();
  } catch {
    return '';
  }
}

export function describeArLimitation(capability, bakeStatus = null) {
  if (bakeStatus && bakeStatus.ok === false) {
    return bakeStatus.reason || 'AR model with your photo could not be prepared.';
  }
  if (capability.mode === 'android_scene_viewer_candidate') {
    return 'Android Scene Viewer is a candidate on this phone, but only after a public HTTPS GLB includes your approved photo. Until then, use View on Wall or place the frame on a photo of your wall.';
  }
  if (capability.mode === 'ios_quicklook_needs_usdz') {
    return 'iOS Quick Look needs a USDZ file with your photo baked in. That export is not enabled yet — use View on Wall or a photo of your wall.';
  }
  if (capability.mode === 'webxr_candidate') {
    return 'This browser reports WebXR, but live vertical-wall AR is not device-verified here. Use View on Wall or a photo of your wall.';
  }
  return 'Live camera AR is not available on this device. Use View on Wall, or place the frame on a photo of your wall.';
}
