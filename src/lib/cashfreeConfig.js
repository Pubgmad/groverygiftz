const CASHFREE_ENVIRONMENTS = ['sandbox', 'production'];

function normalizeEnvironment(value) {
  return CASHFREE_ENVIRONMENTS.includes(value) ? value : 'sandbox';
}

function parseBoolean(value) {
  if (value === undefined || value === null || value === '') return null;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return null;
}

export function getCashfreeConfig(settings = {}) {
  const envEnabled = parseBoolean(process.env.CASHFREE_ENABLED);
  const appId = process.env.CASHFREE_APP_ID || settings?.cashfreeAppId || '';
  const secretKey = process.env.CASHFREE_SECRET_KEY || settings?.cashfreeSecretKey || '';
  const environment = normalizeEnvironment(process.env.CASHFREE_ENVIRONMENT || settings?.cashfreeEnvironment || 'sandbox');

  return {
    enabled: envEnabled ?? !!settings?.cashfreeEnabled,
    appId,
    secretKey,
    environment,
  };
}

