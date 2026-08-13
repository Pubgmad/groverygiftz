export const dynamic = 'force-dynamic';
import dbConnect from '@/lib/db';
import Collection from '@/models/Collection';
import Product from '@/models/Product';
import ProductCard from '@/components/product/ProductCard';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import { notFound } from 'next/navigation';
import { priceRangeMatchExpression, variantAwareEffectivePriceExpression } from '@/lib/offers';

const PRICE_RANGES = [
  { label: 'Under INR 299', min: 0, max: 299 },
  { label: 'INR 299 - INR 599', min: 299, max: 599 },
  { label: 'INR 599 - INR 999', min: 599, max: 999 },
  { label: 'INR 999 - INR 1,999', min: 999, max: 1999 },
  { label: 'Above INR 1,999', min: 1999, max: null },
];

export default async function CollectionPage({ params, searchParams }) {
  await dbConnect();
  const collection = await Collection.findOne({ slug: params.slug, isActive: true }).lean();
  if (!collection) notFound();

  const page = Number(searchParams?.page) || 1;
  const limit = 24;
  const skip = (page - 1) * limit;
  const currentSort = searchParams?.sort || 'newest';
  const priceKey = searchParams?.price || '';
  const priceRangeIdx = PRICE_RANGES.findIndex((_, i) => `r${i}` === priceKey);
  const currentRange = priceRangeIdx >= 0 ? PRICE_RANGES[priceRangeIdx] : null;
  const now = new Date();
  const effectivePrice = variantAwareEffectivePriceExpression(now);
  const sort =
    currentSort === 'price-asc' ? { effectivePrice: 1, createdAt: -1 } :
    currentSort === 'price-desc' ? { effectivePrice: -1, createdAt: -1 } :
    { createdAt: -1 };

  const productFilter = { collections: collection._id, isActive: true };
  if (currentRange) {
    productFilter.$expr = priceRangeMatchExpression(currentRange, now);
  }

  const [products, total] = await Promise.all([
    Product.aggregate([
      { $match: productFilter },
      { $addFields: { effectivePrice } },
      { $sort: sort },
      { $skip: skip },
      { $limit: limit },
    ]),
    Product.countDocuments(productFilter),
  ]);

  const totalPages = Math.ceil(total / limit);
  const data = JSON.parse(JSON.stringify(products));

  const buildUrl = (extra = {}) => {
    const q = { sort: currentSort, price: priceKey, ...extra };
    const str = Object.entries(q)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');
    return `/collections/${params.slug}${str ? '?' + str : ''}`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <Breadcrumbs items={[{ label: 'Shop', href: '/shop' }, { label: collection.name }]} />
      <div className="mb-6">
        <h1 className="text-3xl md:text-4xl font-display font-bold">{collection.name}</h1>
        <p className="text-gray-500 mt-1">{total} items</p>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        <aside className="md:w-52 flex-shrink-0">
          <div className="bg-white rounded-xl border p-4 md:sticky md:top-24">
            <h3 className="font-bold mb-4 text-sm uppercase tracking-wide text-gray-700">Filter</h3>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Price Range</p>
              <ul className="space-y-1">
                <li>
                  <a href={buildUrl({ price: '', page: '1' })}
                    className={`block text-sm py-1.5 px-2 rounded-lg transition-colors ${!priceKey ? 'text-primary-600 font-semibold bg-primary-50' : 'text-gray-700 hover:bg-gray-50'}`}>
                    All Prices
                  </a>
                </li>
                {PRICE_RANGES.map((r, i) => (
                  <li key={i}>
                    <a href={buildUrl({ price: `r${i}`, page: '1' })}
                      className={`block text-sm py-1.5 px-2 rounded-lg transition-colors ${priceKey === `r${i}` ? 'text-primary-600 font-semibold bg-primary-50' : 'text-gray-700 hover:bg-gray-50'}`}>
                      {r.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </aside>

        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
            <p className="text-sm text-gray-500">{total} product{total !== 1 ? 's' : ''}</p>
            <div className="flex flex-wrap gap-2">
              {['newest', 'price-asc', 'price-desc'].map(s => (
                <a key={s} href={buildUrl({ sort: s, page: '1' })}
                  className={`px-3 py-1.5 rounded-lg text-sm border ${currentSort === s ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-300 hover:border-gray-400'}`}>
                  {s === 'newest' ? 'Newest' : s === 'price-asc' ? 'Low to High' : 'High to Low'}
                </a>
              ))}
            </div>
          </div>

          {data.length === 0 ? (
            <p className="text-center py-12 text-gray-500">No products in this range yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 md:gap-6 lg:grid-cols-4">
              {data.map(product => <ProductCard key={product._id} product={product} />)}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex justify-center flex-wrap gap-2 mt-8">
              {page > 1 && (
                <a href={buildUrl({ page: String(page - 1) })}
                  className="px-4 h-10 rounded-lg flex items-center text-sm font-medium border bg-white hover:bg-gray-50">
                  &lt;- Prev
                </a>
              )}
              {Array.from({ length: totalPages }, (_, i) => (
                <a key={i} href={buildUrl({ page: String(i + 1) })}
                  className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-medium ${page === i + 1 ? 'bg-primary-600 text-white' : 'border bg-white hover:bg-gray-50'}`}>
                  {i + 1}
                </a>
              ))}
              {page < totalPages && (
                <a href={buildUrl({ page: String(page + 1) })}
                  className="px-4 h-10 rounded-lg flex items-center text-sm font-medium border bg-white hover:bg-gray-50">
                  Next -&gt;
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

