import dbConnect from '@/lib/db';
import Product from '@/models/Product';
import Collection from '@/models/Collection';
import Blog from '@/models/Blog';

const baseUrl = (process.env.NEXTAUTH_URL || 'https://groverygiftz.in').replace(/\/$/, '');

export default async function sitemap() {
  const staticRoutes = ['', '/shop', '/about', '/contact', '/blogs', '/track-order', '/policies/privacy-policy', '/policies/terms-conditions', '/policies/shipping-policy', '/policies/refund-policy'].map((path) => ({
    url: baseUrl + path,
    lastModified: new Date(),
    changeFrequency: path === '' || path === '/shop' ? 'daily' : 'weekly',
    priority: path === '' ? 1 : 0.7,
  }));

  try {
    await dbConnect();
    const [products, collections, blogs] = await Promise.all([
      Product.find({ isActive: true }).select('slug updatedAt').lean(),
      Collection.find({ isActive: true }).select('slug updatedAt').lean(),
      Blog.find({ isPublished: true }).select('slug updatedAt').lean(),
    ]);

    return [
      ...staticRoutes,
      ...products.map((item) => ({ url: baseUrl + '/products/' + item.slug, lastModified: item.updatedAt || new Date(), changeFrequency: 'weekly', priority: 0.9 })),
      ...collections.map((item) => ({ url: baseUrl + '/collections/' + item.slug, lastModified: item.updatedAt || new Date(), changeFrequency: 'weekly', priority: 0.8 })),
      ...blogs.map((item) => ({ url: baseUrl + '/blogs/' + item.slug, lastModified: item.updatedAt || new Date(), changeFrequency: 'monthly', priority: 0.6 })),
    ];
  } catch (error) {
    return staticRoutes;
  }
}
