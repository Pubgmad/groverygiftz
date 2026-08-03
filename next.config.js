const siteUrl = process.env.NEXTAUTH_URL || process.env.URL || process.env.DEPLOY_PRIME_URL || 'http://localhost:3000';
process.env.NEXTAUTH_URL = siteUrl;

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXTAUTH_URL: siteUrl,
  },
  async redirects() {
    return [
      { source: '/admin', destination: '/account/manage', permanent: false },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
    unoptimized: true,
  },
};

module.exports = nextConfig;
