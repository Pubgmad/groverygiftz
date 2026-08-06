export default function robots() {
  const baseUrl = process.env.NEXTAUTH_URL || 'https://groverygiftz.in';
  const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/account/manage', '/admin', '/api'] },
    ],
    sitemap: normalizedBaseUrl + '/sitemap.xml',
    host: normalizedBaseUrl,
  };
}
