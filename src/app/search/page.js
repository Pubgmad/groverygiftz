export const dynamic = 'force-dynamic';
import dbConnect from '@/lib/db';
import Product from '@/models/Product';
import Settings from '@/models/Settings';
import ProductCard from '@/components/product/ProductCard';
import SearchTracker from '@/components/meta/SearchTracker';
import { buildSearchKeywordMaps } from '@/lib/giftFinderResolve';

export default async function SearchPage({ searchParams }) {
  const q = searchParams?.q || '';
  const occasion = searchParams?.occasion || '';
  const giftType = searchParams?.giftType || '';
  let products = [];

  if (q || occasion || giftType) {
    await dbConnect();
    const settings = await Settings.findOne().lean();
    const { occasionKeywords, giftTypeKeywords } = buildSearchKeywordMaps(settings || {});

    const andFilters = [{ isActive: true }];

    const keywordList = [
      ...(occasionKeywords[occasion] || []),
      ...(giftTypeKeywords[giftType] || []),
    ];

    if (q) {
      andFilters.push({
        $or: [
          { title: { $regex: q, $options: 'i' } },
          { description: { $regex: q, $options: 'i' } },
        ],
      });
    }

    if (keywordList.length > 0) {
      andFilters.push({
        $or: keywordList.flatMap((term) => ([
          { title: { $regex: term, $options: 'i' } },
          { description: { $regex: term, $options: 'i' } },
          { slug: { $regex: term.replace(/\s+/g, '-'), $options: 'i' } },
        ])),
      });
    }

    products = await Product.find({ $and: andFilters }).limit(40).lean();

    if (products.length === 0 && q) {
      try {
        products = await Product.find({ $text: { $search: q }, isActive: true }).limit(40).lean();
      } catch {
        products = [];
      }
    }
  }
  const data = JSON.parse(JSON.stringify(products));

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <SearchTracker query={q} occasion={occasion} giftType={giftType} resultCount={data.length} />
      <h1 className="text-3xl font-display font-bold mb-2">Search</h1>
      {(q || occasion || giftType) && (
        <p className="text-gray-500 mb-8">
          Showing results
          {q ? <> for &quot;{q}&quot;</> : null}
          {occasion ? <> | Occasion: <span className="font-medium capitalize">{occasion.replace(/-/g, ' ')}</span></> : null}
          {giftType ? <> | Type: <span className="font-medium capitalize">{giftType.replace(/-/g, ' ')}</span></> : null}
          {' '}({data.length} items)
        </p>
      )}
      {!q && !occasion && !giftType && (
        <div className="text-center py-16">
          <p className="text-gray-500 text-lg">Enter a search term or use the Gift Recommender on the home page.</p>
        </div>
      )}
      {(q || occasion || giftType) && data.length === 0 && (
        <div className="text-center py-16">
          <p className="text-gray-500 text-lg">No matching products found. Try different keywords or filters.</p>
        </div>
      )}
      {data.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 md:gap-6 lg:grid-cols-4">
          {data.map((p) => <ProductCard key={p._id} product={p} />)}
        </div>
      )}
    </div>
  );
}
