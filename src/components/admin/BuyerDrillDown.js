'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FiX } from 'react-icons/fi';
import { formatPrice } from '@/lib/utils';
import AdminSelect from '@/components/admin/AdminSelect';

const TITLES = {
  unique: 'Unique buyers',
  repeat: 'Repeat buyers in period',
  returning: 'Returning buyers',
};

const HINTS = {
  unique: 'Each identifiable customer with at least one qualifying paid order in this date range.',
  repeat: 'Customers who placed two or more qualifying paid orders inside this date range.',
  returning: 'Customers who purchased in this date range and also had an earlier qualifying purchase before it.',
};

const SORT_OPTIONS = [
  { value: 'spent', label: 'Sort by spend' },
  { value: 'orders', label: 'Sort by orders' },
  { value: 'last', label: 'Sort by latest purchase' },
];

export default function BuyerDrillDown({ open, kind, query, range, onClose }) {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('spent');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ buyers: [], total: 0, pages: 1 });
  const [loading, setLoading] = useState(false);
  const [selectedKey, setSelectedKey] = useState('');
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const listQuery = useMemo(() => {
    const params = new URLSearchParams(query);
    params.set('kind', kind || 'unique');
    params.set('search', search);
    params.set('sort', sort);
    params.set('page', String(page));
    params.set('limit', '20');
    return params.toString();
  }, [kind, page, query, search, sort]);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/admin/revenue/buyers?${listQuery}`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled && !json.error) setData(json);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [listQuery, open]);

  useEffect(() => {
    setSelectedKey('');
    setDetail(null);
    setData({ buyers: [], total: 0, pages: 1 });
    setPage(1);
  }, [kind]);

  useEffect(() => {
    if (!open) {
      setSearchInput('');
      setSearch('');
      setSort('spent');
    }
  }, [open]);

  const openBuyer = async (key) => {
    setSelectedKey(key);
    setDetail(null);
    setDetailLoading(true);
    const params = new URLSearchParams(query);
    params.set('buyerKey', key);
    const res = await fetch(`/api/admin/revenue/buyers?${params}`, { cache: 'no-store' });
    const json = await res.json().catch(() => ({}));
    setDetail(json);
    setDetailLoading(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-stretch sm:justify-end">
      <div className="relative z-10 flex h-[92dvh] max-h-[92dvh] w-full min-w-0 flex-col overflow-hidden rounded-t-3xl bg-white pb-[env(safe-area-inset-bottom)] sm:ml-auto sm:h-full sm:max-h-none sm:max-w-xl sm:rounded-none sm:pb-0">
        <div className="flex items-start justify-between gap-3 border-b p-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold leading-tight">{TITLES[kind] || 'Buyers'}</h2>
            <p className="mt-1 text-xs leading-5 text-gray-500">{HINTS[kind]} {range ? `${range.from} to ${range.to} IST.` : ''}</p>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border" aria-label="Close">
            <FiX />
          </button>
        </div>
        <div className="grid min-w-0 gap-2 border-b p-4 sm:grid-cols-[minmax(0,1fr)_13rem]">
          <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search name, email, or mobile" className="min-h-[44px] min-w-0 rounded-lg border px-3 text-sm" />
          <AdminSelect value={sort} onChange={(next) => { setSort(next); setPage(1); }} options={SORT_OPTIONS} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
          {loading && !data.buyers?.length && <p className="text-sm text-gray-500">Loading buyers...</p>}
          {(data.buyers || []).map((buyer) => (
            <button key={buyer.key} type="button" onClick={() => openBuyer(buyer.key)} className="mb-2 w-full min-w-0 rounded-2xl border p-3 text-left">
              <p className="truncate font-semibold">{buyer.name}</p>
              <p className="break-all text-xs leading-5 text-gray-500">{buyer.email || 'No email'}{buyer.phone ? ` · ${buyer.phone}` : ''}</p>
              <p className="mt-1 text-xs leading-5 text-gray-600">{buyer.orders} orders · {formatPrice(buyer.collected)} · last {buyer.lastAt ? new Date(buyer.lastAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : '—'}</p>
            </button>
          ))}
          {!loading && !data.buyers?.length && <p className="text-sm text-gray-500">No buyers match this metric and date range.</p>}
          {data.pages > 1 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {Array.from({ length: data.pages }, (_, index) => (
                <button key={index} type="button" onClick={() => setPage(index + 1)} className={`min-h-[36px] min-w-[36px] rounded-lg border text-sm ${page === index + 1 ? 'bg-primary-600 text-white' : ''}`}>{index + 1}</button>
              ))}
            </div>
          )}
          {selectedKey && detailLoading && <p className="mt-4 text-sm text-gray-500">Loading purchase history...</p>}
          {selectedKey && detail?.buyer && (
            <div className="mt-4 min-w-0 rounded-2xl border p-3">
              <p className="break-words font-bold">{detail.buyer.name}</p>
              <p className="break-all text-xs leading-5 text-gray-500">{detail.buyer.email || 'No email'}{detail.buyer.phone ? ` · ${detail.buyer.phone}` : ''}</p>
              <div className="mt-3 grid grid-cols-1 gap-2 text-xs leading-5 sm:grid-cols-2">
                <p>Period orders: {detail.buyer.orders}</p>
                <p>Period spend: {formatPrice(detail.buyer.collected)}</p>
                <p>Lifetime orders: {detail.lifetime?.orders || 0}</p>
                <p>Lifetime spend: {formatPrice(detail.lifetime?.collected || 0)}</p>
                <p>First purchase: {detail.lifetime?.firstAt ? new Date(detail.lifetime.firstAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : '—'}</p>
                <p>Latest purchase: {detail.lifetime?.lastAt ? new Date(detail.lifetime.lastAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : '—'}</p>
                <p>Average order: {formatPrice(detail.lifetime?.averageOrderValue || 0)}</p>
                <p className="min-w-0 break-words">Favorite product: {detail.lifetime?.favoriteProduct || '—'}</p>
              </div>
              <p className="mt-2 text-xs leading-5 text-gray-500">{detail.lifetime?.returning ? 'Returning customer historically.' : 'No earlier qualifying purchase before this period.'}</p>
              <div className="mt-3 space-y-3">
                {(detail.orders || []).map((order) => (
                  <div key={order.id} className="min-w-0 rounded-xl bg-gray-50 p-3">
                    <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                      <p className="min-w-0 break-all font-semibold">{order.orderNumber}</p>
                      <Link href={`/account/manage/orders?orderId=${encodeURIComponent(order.orderNumber)}&dateFrom=${encodeURIComponent(range?.from || '')}&dateTo=${encodeURIComponent(range?.to || '')}`} className="inline-flex min-h-[36px] shrink-0 items-center text-xs font-semibold text-primary-700">Open order</Link>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-gray-500">{order.date ? new Date(order.date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : ''} · {order.paymentStatus} · {order.status}</p>
                    {(order.items || []).map((item, index) => (
                      <div key={`${order.id}-${index}`} className="mt-2 flex min-w-0 gap-2 text-xs">
                        {item.image ? <img src={item.image} alt="" className="h-10 w-10 shrink-0 rounded object-cover" /> : <span className="h-10 w-10 shrink-0 rounded bg-gray-200" />}
                        <div className="min-w-0">
                          <p className="truncate font-medium">{item.title}</p>
                          <p className="break-words text-gray-500">{item.variant || 'No variant'} · qty {item.quantity} · {formatPrice(item.price)}</p>
                        </div>
                      </div>
                    ))}
                    <p className="mt-2 text-right text-sm font-bold">{formatPrice(order.total)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
