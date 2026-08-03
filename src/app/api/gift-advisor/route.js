import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Product from '@/models/Product';

function scoreProduct(product, terms) {
  const text = [
    product.title,
    product.slug,
    product.description,
    product.shortDescription,
    product.tags?.join(' '),
    product.collections?.map((c) => c.title || c.name || c.slug).join(' '),
  ].filter(Boolean).join(' ').toLowerCase();

  if (!terms.length) return product.isFeatured ? 3 : 1;

  return terms.reduce((score, term) => {
    if (!term) return score;
    if (String(product.title || '').toLowerCase().includes(term)) return score + 5;
    if (text.includes(term)) return score + 2;
    return score;
  }, product.isFeatured ? 1 : 0);
}

function recommendationsFromCatalogue(products, terms) {
  return products
    .map((product) => ({ product, score: scoreProduct(product, terms) }))
    .filter(({ score }) => !terms.length || score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map(({ product }) => ({
      _id: product._id,
      title: product.title,
      slug: product.slug,
      image: product.images?.[0] || '',
      price: product.salePrice && product.salePrice < product.regularPrice ? product.salePrice : product.regularPrice,
      reason: terms.length
        ? 'Matched from products currently available in this store.'
        : 'Popular product from the current store catalogue.',
    }));
}

export async function POST(req) {
  await dbConnect();
  const body = await req.json();
  const query = `${body.query || ''} ${body.occasion || ''} ${body.giftType || ''}`.trim();
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const products = await Product.find({ isActive: true })
    .populate('collections', 'title name slug')
    .sort({ isFeatured: -1, createdAt: -1 })
    .limit(80)
    .lean();

  return NextResponse.json({ mode: 'catalogue', recommendations: recommendationsFromCatalogue(products, terms) });
}
