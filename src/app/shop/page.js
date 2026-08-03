export const dynamic = 'force-dynamic';
import dbConnect from '@/lib/db';
import Collection from '@/models/Collection';
import Product from '@/models/Product';
import ProductCard from '@/components/product/ProductCard';
import Link from 'next/link';

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

export default async function ShopPage({ searchParams }) {
  await dbConnect();

  const page = Number(searchParams?.page) || 1;
  const limit = 24;
  const skip = (page - 1) * limit;
  const currentSort = searchParams?.sort || 'newest';
  const now = new Date();
  const sort =
    currentSort === 'price-asc' ? { effectivePrice: 1, createdAt: -1 } :
    currentSort === 'price-desc' ? { effectivePrice: -1, createdAt: -1 } :
    { createdAt: -1 };

  const [collections, products, total] = await Promise.all([
    Collection.find({ isActive: true }).sort({ order: 1 }).lean(),
    Product.aggregate([
      { $match: { isActive: true } },
      { $addFields: { effectivePrice: effectivePriceExpression(now) } },
      { $sort: sort },
      { $skip: skip },
      { $limit: limit },
    ]),
    Product.countDocuments({ isActive: true }),
  ]);

  const collectionsData = JSON.parse(JSON.stringify(collections));
  const productsData = JSON.parse(JSON.stringify(products));
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl md:text-4xl font-display font-bold mb-8">Shop</h1>

      {collectionsData.length > 0 && (
        <>
          <h2 className="text-xl font-bold mb-4">Browse by Collection</h2>
          <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-6 mb-10 md:mb-12">
            {collectionsData.map(col => (
              <Link key={col._id} href={`/collections/${col.slug}`}
                className="group relative aspect-square rounded-xl overflow-hidden card-hover">
                {col.image ? (
                  <img src={col.image} alt={col.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary-100 to-accent-100" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex flex-col items-center justify-end p-3">
                  <h3 className="text-white font-semibold text-sm text-center leading-tight">{col.name}</h3>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <h2 className="text-xl font-bold">
          All Products{' '}
          <span className="text-gray-400 font-normal text-base">({total} items)</span>
        </h2>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          {['newest', 'price-asc', 'price-desc'].map(s => (
            <a key={s} href={`/shop?sort=${s}`}
              className={`flex-1 sm:flex-none text-center px-3 py-1.5 rounded-lg text-xs sm:text-sm border ${
                currentSort === s
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'border-gray-300 hover:border-gray-400'
              }`}>
              {s === 'newest' ? 'Newest' : s === 'price-asc' ? 'Price: Low to High' : 'Price: High to Low'}
            </a>
          ))}
        </div>
      </div>

      {productsData.length === 0 ? (
        <p className="text-center py-12 text-gray-500">No products yet. Add products from the admin panel.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 md:gap-6 lg:grid-cols-4">
          {productsData.map(product => <ProductCard key={product._id} product={product} />)}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center flex-wrap gap-2 mt-8">
          {page > 1 && (
            <a href={`/shop?page=${page - 1}&sort=${currentSort}`}
              className="px-4 h-10 rounded-lg flex items-center text-sm font-medium border bg-white hover:bg-gray-50">
              &lt;- Prev
            </a>
          )}
          {Array.from({ length: totalPages }, (_, i) => (
            <a key={i} href={`/shop?page=${i + 1}&sort=${currentSort}`}
              className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-medium ${
                page === i + 1 ? 'bg-primary-600 text-white' : 'border bg-white hover:bg-gray-50'
              }`}>
              {i + 1}
            </a>
          ))}
          {page < totalPages && (
            <a href={`/shop?page=${page + 1}&sort=${currentSort}`}
              className="px-4 h-10 rounded-lg flex items-center text-sm font-medium border bg-white hover:bg-gray-50">
              Next -&gt;
            </a>
          )}
        </div>
      )}
    </div>
  );
}
