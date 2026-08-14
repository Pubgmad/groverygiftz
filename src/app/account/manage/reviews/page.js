'use client';
import { useEffect, useMemo, useState } from 'react';
import { FiStar } from 'react-icons/fi';

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function Stars({ rating = 0 }) {
  const count = Number(rating || 0);
  return (
    <span className="inline-flex gap-0.5 text-amber-400">
      {[1, 2, 3, 4, 5].map((star) => (
        <FiStar key={star} size={15} className={star <= count ? 'fill-amber-400 stroke-amber-400' : 'stroke-gray-300'} />
      ))}
    </span>
  );
}

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    fetch('/api/reviews')
      .then((r) => r.json())
      .then((d) => {
        const nextReviews = Array.isArray(d.reviews) ? d.reviews : [];
        setReviews(nextReviews);
        setSelected(nextReviews[0] || null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filteredReviews = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return reviews;
    return reviews.filter((review) => [
      review.productName,
      review.name,
      review.customer?.email,
      review.orderNumber,
      review.comment,
    ].some((value) => String(value || '').toLowerCase().includes(term)));
  }, [query, reviews]);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Customer Reviews ({reviews.length})</h1>
          <p className="mt-1 text-sm text-gray-500">Verified feedback submitted after successful customer orders.</p>
        </div>
        <div className="w-full sm:w-72">
          <label className="mb-1 block text-xs font-semibold text-gray-500">Search</label>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:border-primary-500"
            placeholder="Product, customer, order"
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="bg-white rounded-xl border overflow-hidden lg:col-span-2">
          {loading ? <p className="p-6 text-center">Loading...</p> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="p-4">Product</th>
                    <th className="p-4">Customer</th>
                    <th className="p-4">Rating</th>
                    <th className="p-4">Order</th>
                    <th className="p-4">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReviews.map((review) => (
                    <tr
                      key={review._id}
                      onClick={() => setSelected(review)}
                      className={`border-t cursor-pointer hover:bg-gray-50 ${selected?._id === review._id ? 'bg-primary-50' : ''}`}
                    >
                      <td className="p-4">
                        <p className="max-w-[240px] truncate font-semibold text-gray-900">{review.productName || '-'}</p>
                        <p className="mt-1 max-w-[260px] truncate text-xs text-gray-500">{review.comment}</p>
                      </td>
                      <td className="p-4">
                        <p className="font-medium text-gray-900">{review.name || 'Customer'}</p>
                        {review.customer?.email && <p className="mt-1 text-xs text-gray-500">{review.customer.email}</p>}
                      </td>
                      <td className="p-4"><Stars rating={review.rating} /></td>
                      <td className="p-4 font-mono text-xs text-gray-600">{review.orderNumber || '-'}</td>
                      <td className="p-4 text-gray-500">{formatDate(review.createdAt)}</td>
                    </tr>
                  ))}
                  {filteredReviews.length === 0 && (
                    <tr><td colSpan={5} className="p-6 text-center text-gray-500">No reviews found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border p-4 sm:p-6">
          {selected ? (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-bold uppercase text-primary-600">{selected.verified ? 'Verified purchase' : 'Review'}</p>
                <h2 className="mt-1 break-words text-lg font-bold text-gray-900">{selected.productName || 'Product review'}</h2>
              </div>
              <div className="flex items-center gap-2">
                <Stars rating={selected.rating} />
                <span className="text-sm font-semibold text-gray-700">{selected.rating}/5</span>
              </div>
              <div className="space-y-2 text-sm">
                <div><span className="text-gray-500">Customer:</span> {selected.name || 'Customer'}</div>
                {selected.customer?.email && <div className="break-all"><span className="text-gray-500">Email:</span> {selected.customer.email}</div>}
                <div><span className="text-gray-500">Order:</span> {selected.orderNumber || '-'}</div>
                <div><span className="text-gray-500">Date:</span> {formatDate(selected.createdAt)}</div>
              </div>
              <div className="border-t pt-4">
                <p className="whitespace-pre-wrap break-words text-sm leading-6 text-gray-700">{selected.comment}</p>
              </div>
            </div>
          ) : (
            <p className="py-8 text-center text-gray-500">Select a review to view details</p>
          )}
        </div>
      </div>
    </div>
  );
}

