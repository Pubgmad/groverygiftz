export const dynamic = 'force-dynamic';
import dbConnect from '@/lib/db';
import Product from '@/models/Product';
import Collection from '@/models/Collection';
import ProductCard from '@/components/product/ProductCard';
import Link from 'next/link';

const VALID_VIEWS = ['collections', 'offers', 'latest', 'best-sellers'];

function effectivePriceExpression(now) {
  return {
    $cond: [
      {
        $and: [
          { $gt: ['$salePrice', 0] },
          { $lt: ['$salePrice', '$regularPrice'] },
          { $or: [{ $eq: [{ $ifNull: ['$offerStartsAt', null] }, null] }, { $lte: ['$offerStartsAt', now] }] },
          { $or: [{ $eq: [{ $ifNull: ['$offerEndsAt', null] }, null] }, { $gte: ['$offerEndsAt', now] }] },
        ],
      },
      '$salePrice',
      '$regularPrice',
    ],
  };
}

function activeOfferMatch(now) {
  return {
    salePrice: { $gt: 0 },
    offerStartsAt: { $type: 'date', $lte: now },
    offerEndsAt: { $type: 'date', $gte: now },
    $expr: { $lt: ['$salePrice', '$regularPrice'] },
  };
}

export default async function ShopPage({ searchParams }) {
  await dbConnect();

  const page = Number(searchParams?.page) || 1;
  const limit = 24;
  const skip = (page - 1) * limit;
  const currentSort = searchParams?.sort || 'newest';
  const currentView = VALID_VIEWS.includes(searchParams?.view) ? searchParams.view : '';
  const isFilteredView = Boolean(currentView);
  const isCollectionsView = currentView === 'collections';
  const now = new Date();
  const latestSince = new Date(now);
  latestSince.setMonth(latestSince.getMonth() - 3);
  const sort =
    currentSort === 'price-asc' ? { effectivePrice: 1, createdAt: -1 } :
    currentSort === 'price-desc' ? { effectivePrice: -1, createdAt: -1 } :
    { createdAt: -1 };
  const match = { isActive: true };
  if (currentView === 'offers') Object.assign(match, activeOfferMatch(now));
  if (currentView === 'latest') match.createdAt = { $gte: latestSince };
  if (currentView === 'best-sellers') match.isBestSeller = true;

  const [collections, products, totalResult] = await Promise.all([
    isCollectionsView ? Collection.find({ isActive: true }).sort({ order: 1 }).lean() : Promise.resolve([]),
    Product.aggregate([
      { $match: match },
      { $addFields: { effectivePrice: effectivePriceExpression(now) } },
      { $sort: sort },
      { $skip: skip },
      { $limit: limit },
    ]),
    Product.aggregate([{ $match: match }, { $count: 'total' }]),
  ]);

  const total = totalResult[0]?.total || 0;

  const collectionsData = JSON.parse(JSON.stringify(collections));
  const productsData = JSON.parse(JSON.stringify(products));
  const totalPages = Math.ceil(total / limit);
  const currentViewLabel = currentView === 'offers' ? 'Limited Time Offers' : currentView === 'latest' ? 'Latest Products' : currentView === 'best-sellers' ? 'Best Sellers' : currentView === 'collections' ? 'Gift Collections' : 'All Products';
  const makeHref = (params = {}) => {
    const next = new URLSearchParams();
    const view = Object.prototype.hasOwnProperty.call(params, 'view') ? params.view : currentView;
    const sortValue = params.sort || currentSort;
    const pageValue = params.page || 1;
    if (view) next.set('view', view);
    if (sortValue && sortValue !== 'newest') next.set('sort', sortValue);
    if (pageValue > 1) next.set('page', String(pageValue));
    const query = next.toString();
    return query ? `/shop?${query}` : '/shop';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl md:text-4xl font-display font-bold mb-8">Shop</h1>

      {isFilteredView && (
        <div className="mb-6">
          <Link href="/shop" className="inline-flex rounded-full border border-accent-100 bg-white px-4 py-2 text-sm font-semibold text-accent-700 hover:border-accent-300">
            Back to all products
          </Link>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <h2 className="text-xl font-bold">
          {currentViewLabel}{' '}
          <span className="text-gray-400 font-normal text-base">({isCollectionsView ? collectionsData.length : total} {isCollectionsView ? 'collections' : 'items'})</span>
        </h2>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          {['newest', 'price-asc', 'price-desc'].map(s => (
            <a key={s} href={makeHref({ sort: s })}
              className={`flex-1 sm:flex-none text-center px-3 py-1.5 rounded-lg text-xs sm:text-sm border ${
                currentSort === s
                  ? 'bg-accent-500 text-white border-accent-500'
                  : 'border-gray-300 hover:border-accent-300'
              }`}>
              {s === 'newest' ? 'Newest' : s === 'price-asc' ? 'Price: Low to High' : 'Price: High to Low'}
            </a>
          ))}
        </div>
      </div>

      {isCollectionsView ? (
        collectionsData.length === 0 ? <p className="text-center py-12 text-gray-500">No active collections yet.</p> : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 md:gap-6 lg:grid-cols-4">
            {collectionsData.map((col) => (
              <Link key={col._id} href={`/collections/${col.slug}`} className="group relative aspect-[4/5] overflow-hidden rounded-2xl bg-white product-lift">
                {col.image ? <img src={col.image} alt={col.name} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" /> : <div className="h-full w-full bg-warm-gradient" />}
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-4">
                  <h3 className="text-lg font-display font-extrabold leading-tight text-white drop-shadow-[0_3px_8px_rgba(0,0,0,0.95)]">{col.name}</h3>
                  <span className="mt-3 inline-flex rounded-full bg-white px-4 py-2 text-xs font-extrabold text-accent-700">View collection</span>
                </div>
              </Link>
            ))}
          </div>
        )
      ) : productsData.length === 0 ? (
        <p className="text-center py-12 text-gray-500">No matching products yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 md:gap-6 lg:grid-cols-4">
          {productsData.map(product => <ProductCard key={product._id} product={product} />)}
        </div>
      )}

      {!isCollectionsView && totalPages > 1 && (
        <div className="flex justify-center flex-wrap gap-2 mt-8">
          {page > 1 && (
            <a href={makeHref({ page: page - 1 })}
              className="px-4 h-10 rounded-lg flex items-center text-sm font-medium border bg-white hover:bg-gray-50">
              &lt;- Prev
            </a>
          )}
          {Array.from({ length: totalPages }, (_, i) => (
            <a key={i} href={makeHref({ page: i + 1 })}
              className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-medium ${
                page === i + 1 ? 'bg-accent-500 text-white' : 'border bg-white hover:bg-gray-50'
              }`}>
              {i + 1}
            </a>
          ))}
          {page < totalPages && (
            <a href={makeHref({ page: page + 1 })}
              className="px-4 h-10 rounded-lg flex items-center text-sm font-medium border bg-white hover:bg-gray-50">
              Next -&gt;
            </a>
          )}
        </div>
      )}
    </div>
  );
}
