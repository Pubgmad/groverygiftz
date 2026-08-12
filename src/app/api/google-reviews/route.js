export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Settings from '@/models/Settings';

const SERPAPI_ENDPOINT = 'https://serpapi.com/search.json';

function normalizeReview(review = {}) {
  const user = review.user || {};
  return {
    id: review.review_id || review.link || `${user.name || 'google'}-${review.date || review.position || Math.random()}`,
    name: user.name || review.user_name || 'Google reviewer',
    avatar: user.thumbnail || user.image || '',
    rating: Number(review.rating || 0),
    text: review.snippet || review.text || review.extracted_snippet?.original || '',
    date: review.date || review.iso_date || review.relative_date || '',
    link: review.link || '',
    images: Array.isArray(review.images) ? review.images.map((img) => img.thumbnail || img.image || img).filter(Boolean) : [],
  };
}

function rotateReviews(reviews = []) {
  if (reviews.length <= 3) return reviews;
  const slot = Math.floor(Date.now() / (1000 * 60 * 60 * 6));
  const start = slot % reviews.length;
  return [...reviews.slice(start), ...reviews.slice(0, start)];
}

function buildPayload(data = {}) {
  const place = data.place_info || data.place_results || {};
  const reviews = (data.reviews || []).map(normalizeReview).filter((review) => review.rating || review.text);
  const rating = Number(place.rating || 0);
  const reviewCount = Number(place.reviews || place.reviews_count || 0);
  return {
    enabled: true,
    source: 'serpapi-google-maps',
    title: place.title || 'Google Reviews',
    rating,
    reviewCount,
    topics: Array.isArray(data.topics) ? data.topics.slice(0, 5).map((topic) => ({ keyword: topic.keyword, mentions: topic.mentions })) : [],
    reviews,
    fetchedAt: new Date().toISOString(),
  };
}

async function fetchFromSerpApi(settings) {
  const url = new URL(SERPAPI_ENDPOINT);
  url.searchParams.set('engine', 'google_maps_reviews');
  url.searchParams.set('api_key', settings.googleReviewsSerpApiKey);
  url.searchParams.set('hl', 'en');
  url.searchParams.set('sort_by', settings.googleReviewsSortBy || 'newestFirst');
  if (settings.googleReviewsPlaceId) url.searchParams.set('place_id', settings.googleReviewsPlaceId);
  else url.searchParams.set('data_id', settings.googleReviewsDataId);

  const res = await fetch(url, { cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(data.error || 'Unable to fetch Google reviews');
  return buildPayload(data);
}

export async function GET(request) {
  await dbConnect();
  const settings = await Settings.findOne();
  if (!settings?.googleReviewsEnabled || !settings.googleReviewsSerpApiKey || (!settings.googleReviewsPlaceId && !settings.googleReviewsDataId)) {
    return NextResponse.json({ enabled: false, reviews: [], topics: [] });
  }

  const forceRefresh = new URL(request.url).searchParams.get('refresh') === '1';
  const cacheHours = Math.max(1, Number(settings.googleReviewsCacheHours || 12));
  const fetchedAt = settings.googleReviewsCacheFetchedAt ? new Date(settings.googleReviewsCacheFetchedAt).getTime() : 0;
  const cacheFresh = fetchedAt && (Date.now() - fetchedAt) < cacheHours * 60 * 60 * 1000;

  if (!forceRefresh && cacheFresh && settings.googleReviewsCache) {
    const cached = settings.googleReviewsCache;
    return NextResponse.json({ ...cached, reviews: rotateReviews(cached.reviews || []) });
  }

  try {
    const payload = await fetchFromSerpApi(settings);
    settings.googleReviewsCache = payload;
    settings.googleReviewsCacheFetchedAt = new Date();
    await settings.save();
    return NextResponse.json({ ...payload, reviews: rotateReviews(payload.reviews || []) });
  } catch (error) {
    if (settings.googleReviewsCache) {
      const cached = settings.googleReviewsCache;
      return NextResponse.json({ ...cached, stale: true, error: error.message, reviews: rotateReviews(cached.reviews || []) });
    }
    return NextResponse.json({ enabled: false, reviews: [], topics: [], error: error.message }, { status: 200 });
  }
}
