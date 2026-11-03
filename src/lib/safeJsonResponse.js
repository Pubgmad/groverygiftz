/**
 * Parse fetch Response bodies that are expected to be JSON.
 * Hosting/proxy layers (nginx, Hostinger, CDN) often return HTML error pages
 * (413/502/504) — calling response.json() then throws:
 *   Unexpected token '<', "<html>..." is not valid JSON
 */

export function messageForUploadHttpStatus(status) {
  if (status === 413) {
    return 'This photo is too large for the server. Please choose a smaller image and try again.';
  }
  if (status === 401 || status === 403) {
    return 'Your session expired. Please refresh the page and try again.';
  }
  if (status === 404) {
    return 'Upload service was not found. Please refresh the page and try again.';
  }
  if (status === 408 || status === 504) {
    return 'The server timed out while saving your photo. Please try again.';
  }
  if (status === 502 || status === 503) {
    return 'The server is temporarily unavailable. Please try again in a moment.';
  }
  if (status >= 500) {
    return 'Server error while saving your photo. Please try again.';
  }
  if (status >= 400) {
    return 'Unable to save your photo. Please try again.';
  }
  return 'Unable to save your photo. Please try again.';
}

export async function readJsonResponse(res, { fallbackError = 'Request failed. Please try again.' } = {}) {
  const contentType = String(res.headers.get('content-type') || '').toLowerCase();
  const text = await res.text();
  const trimmed = String(text || '').trim();

  if (!trimmed) {
    if (!res.ok) throw new Error(messageForUploadHttpStatus(res.status) || fallbackError);
    return {};
  }

  const looksJson = contentType.includes('application/json') || contentType.includes('+json') || trimmed.startsWith('{') || trimmed.startsWith('[');
  if (!looksJson) {
    throw new Error(messageForUploadHttpStatus(res.status) || fallbackError);
  }

  let data;
  try {
    data = JSON.parse(trimmed);
  } catch {
    throw new Error(messageForUploadHttpStatus(res.status) || 'The server returned an invalid response. Please try again.');
  }

  if (!res.ok) {
    throw new Error(data?.error || data?.message || messageForUploadHttpStatus(res.status) || fallbackError);
  }

  return data;
}
