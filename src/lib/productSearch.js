import { escapeRegex } from '@/lib/adminFilters';

export function normalizeProductSearchQuery(value = '') {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 80);
}

export function buildProductTextFilter(rawQuery, { activeOnly = true } = {}) {
  const term = normalizeProductSearchQuery(rawQuery);
  if (!term) return { term: '', filter: null };
  const escaped = escapeRegex(term);
  const slugTerm = escapeRegex(term.replace(/\s+/g, '-'));
  const tokens = term.split(/\s+/).filter(Boolean).slice(0, 6);
  const tokenClauses = tokens.length > 1
    ? tokens.map((token) => ({
      $or: [
        { title: { $regex: escapeRegex(token), $options: 'i' } },
        { description: { $regex: escapeRegex(token), $options: 'i' } },
      ],
    }))
    : [];

  const filter = {
    ...(activeOnly ? { isActive: true } : {}),
    $or: [
      { title: { $regex: escaped, $options: 'i' } },
      { description: { $regex: escaped, $options: 'i' } },
      { slug: { $regex: slugTerm, $options: 'i' } },
      ...(tokenClauses.length ? [{ $and: tokenClauses }] : []),
    ],
  };
  return { term, filter };
}

export function scoreProductMatch(product, term) {
  const q = normalizeProductSearchQuery(term).toLowerCase();
  if (!q) return 0;
  const title = String(product?.title || '').toLowerCase();
  const slug = String(product?.slug || '').toLowerCase();
  const description = String(product?.description || '').toLowerCase();
  if (title === q) return 100;
  if (title.startsWith(q)) return 90;
  if (title.includes(` ${q}`) || title.includes(q)) return 75;
  if (slug.includes(q.replace(/\s+/g, '-'))) return 55;
  if (description.includes(q)) return 35;
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length > 1 && tokens.every((token) => title.includes(token) || description.includes(token))) {
    return 45;
  }
  return 10;
}

export function rankProductMatches(products = [], term = '') {
  return [...products]
    .map((product) => ({ product, score: scoreProductMatch(product, term) }))
    .sort((a, b) => b.score - a.score || String(a.product.title || '').localeCompare(String(b.product.title || '')))
    .map((row) => row.product);
}

export async function findProductsForSearch(ProductModel, rawQuery, { limit = 40, activeOnly = true } = {}) {
  const { term, filter } = buildProductTextFilter(rawQuery, { activeOnly });
  if (!filter) return { term: '', products: [] };

  let products = [];
  try {
    const textHits = await ProductModel.find(
      { ...(activeOnly ? { isActive: true } : {}), $text: { $search: term } },
      { score: { $meta: 'textScore' } },
    )
      .sort({ score: { $meta: 'textScore' } })
      .limit(limit)
      .lean();
    products = textHits;
  } catch {
    products = [];
  }

  if (products.length < limit) {
    const regexHits = await ProductModel.find(filter).limit(limit).lean();
    const seen = new Set(products.map((product) => String(product._id)));
    for (const product of regexHits) {
      const id = String(product._id);
      if (seen.has(id)) continue;
      products.push(product);
      seen.add(id);
      if (products.length >= limit) break;
    }
  }

  return { term, products: rankProductMatches(products, term).slice(0, limit) };
}
