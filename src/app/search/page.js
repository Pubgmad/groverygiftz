export const dynamic = 'force-dynamic';
import dbConnect from '@/lib/db';
import Product from '@/models/Product';
import Settings from '@/models/Settings';
import ProductCard from '@/components/product/ProductCard';
import SearchTracker from '@/components/meta/SearchTracker';
import GA4SearchTracker from '@/components/analytics/GA4SearchTracker';
import { buildSearchKeywordMaps } from '@/lib/giftFinderResolve';
import { escapeRegex } from '@/lib/adminFilters';
import { findProductsForSearch, normalizeProductSearchQuery, rankProductMatches } from '@/lib/productSearch';

export default async function SearchPage({ searchParams }) {
  const q = normalizeProductSearchQuery(searchParams?.q || '');
  const occasion = String(searchParams?.occasion || '').trim();
  const giftType = String(searchParams?.giftType || '').trim();
  let products = [];

  if (q || occasion || giftType) {
    await dbConnect();
    const settings = await Settings.findOne().lean();
    const { occasionKeywords, giftTypeKeywords } = buildSearchKeywordMaps(settings || {});
    const keywordList = [
      ...(occasionKeywords[occasion] || []),
      ...(giftTypeKeywords[giftType] || []),
    ].map((term) => normalizeProductSearchQuery(term)).filter(Boolean).slice(0, 12);

    if (q && !keywordList.length) {
      const result = await findProductsForSearch(Product, q, { limit: 40, activeOnly: true });
      products = result.products;
    } else {
      const andFilters = [{ isActive: true }];
      if (q) {
        const escaped = escapeRegex(q);
        andFilters.push({
          $or: [
            { title: { $regex: escaped, $options: 'i' } },
            { description: { $regex: escaped, $options: 'i' } },
            { slug: { $regex: escapeRegex(q.replace(/\s+/g, '-')), $options: 'i' } },
          ],
        });
      }
      if (keywordList.length > 0) {
        andFilters.push({
          $or: keywordList.flatMap((term) => ([
            { title: { $regex: escapeRegex(term), $options: 'i' } },
            { description: { $regex: escapeRegex(term), $options: 'i' } },
            { slug: { $regex: escapeRegex(term.replace(/\s+/g, '-')), $options: 'i' } },
          ])),
        });
      }
      products = await Product.find({ $and: andFilters }).limit(40).lean();
      if (products.length === 0 && q) {
        const fallback = await findProductsForSearch(Product, q, { limit: 40, activeOnly: true });
        products = fallback.products;
      } else if (q) {
        products = rankProductMatches(products, q);
      }
    }
  }
  const data = JSON.parse(JSON.stringify(products));

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <SearchTracker query={q} occasion={occasion} giftType={giftType} resultCount={data.length} />
      <GA4SearchTracker query={q} products={data.map(({ title }) => ({ title }))} />
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
