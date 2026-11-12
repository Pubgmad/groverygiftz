const siteUrl = process.env.NEXTAUTH_URL || process.env.URL || process.env.DEPLOY_PRIME_URL || 'http://localhost:3000';
process.env.NEXTAUTH_URL = siteUrl;

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXTAUTH_URL: siteUrl,
  },
  // Optional 3D viewer (lazy-loaded client-only). Keep packages transpiled for App Router.
  transpilePackages: ['three', '@react-three/fiber', '@react-three/drei'],
  // Keep native/barcode helpers out of the webpack server bundle.
  experimental: {
    serverComponentsExternalPackages: ['bwip-js', 'pdf-lib', 'qrcode', 'sharp'],
  },
  webpack: (config) => {
    // pdfjs optional Node canvas stub — browser JPEG export uses DOM canvas only.
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      canvas: false,
    };
    return config;
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
