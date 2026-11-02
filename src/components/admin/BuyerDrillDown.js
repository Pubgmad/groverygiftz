'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FiX } from 'react-icons/fi';
import { formatPrice } from '@/lib/utils';

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

export default function BuyerDrillDown({ open, kind, query, range, onClose }) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('spent');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ buyers: [], total: 0, pages: 1 });
  const [loading, setLoading] = useState(false);
  const [selectedKey, setSelectedKey] = useState('');
  const [detail, setDetail] = useState(null);

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
        if (!cancelled) setData(json);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [listQuery, open]);

  useEffect(() => {
    if (!open) {
      setSelectedKey('');
      setDetail(null);
      setSearch('');
      setPage(1);
    }
  }, [open, kind]);

  const openBuyer = async (key) => {
    setSelectedKey(key);
    setDetail(null);
    const params = new URLSearchParams(query);
    params.set('buyerKey', key);
    const res = await fetch(`/api/admin/revenue/buyers?${params}`, { cache: 'no-store' });
    const json = await res.json().catch(() => ({}));
    setDetail(json);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-stretch sm:justify-end">
      <div className="flex max-h-[94vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white sm:ml-auto sm:h-full sm:max-h-none sm:max-w-xl sm:rounded-none">
        <div className="flex items-start justify-between gap-3 border-b p-4">
          <div className="min-w-0">
            <h2 className="text-lg font-bold leading-tight">{TITLES[kind] || 'Buyers'}</h2>
            <p className="mt-1 text-xs leading-5 text-gray-500">{HINTS[kind]} {range ? `${range.from} to ${range.to} IST.` : ''}</p>
          </div>
          <button type="button" onClick={onClose} className="min-h-[44px] min-w-[44px] rounded-lg border" aria-label="Close">
            <FiX className="mx-auto" />
          </button>
        </div>
        <div className="grid gap-2 border-b p-4 sm:grid-cols-[1fr_auto]">
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search name, email, or mobile" className="min-h-[44px] rounded-lg border px-3 text-sm" />
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="min-h-[44px] rounded-lg border px-3 text-sm">
            <option value="spent">Sort by spend</option>
            <option value="orders">Sort by orders</option>
            <option value="last">Sort by latest purchase</option>
          </select>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {loading && <p className="text-sm text-gray-500">Loading buyers...</p>}
          {!loading && (data.buyers || []).map((buyer) => (
            <button key={buyer.key} type="button" onClick={() => openBuyer(buyer.key)} className="mb-2 w-full rounded-2xl border p-3 text-left">
              <p className="font-semibold">{buyer.name}</p>
              <p className="text-xs text-gray-500">{buyer.email || 'No email'}{buyer.phone ? ` · ${buyer.phone}` : ''}</p>
              <p className="mt-1 text-xs text-gray-600">{buyer.orders} orders · {formatPrice(buyer.collected)} · last {buyer.lastAt ? new Date(buyer.lastAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : '—'}</p>
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
          {selectedKey && detail?.buyer && (
            <div className="mt-4 rounded-2xl border p-3">
              <p className="font-bold">{detail.buyer.name}</p>
              <p className="text-xs text-gray-500">{detail.buyer.email || 'No email'}{detail.buyer.phone ? ` · ${detail.buyer.phone}` : ''}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <p>Period orders: {detail.buyer.orders}</p>
                <p>Period spend: {formatPrice(detail.buyer.collected)}</p>
                <p>Lifetime orders: {detail.lifetime?.orders || 0}</p>
                <p>Lifetime spend: {formatPrice(detail.lifetime?.collected || 0)}</p>
                <p>First purchase: {detail.lifetime?.firstAt ? new Date(detail.lifetime.firstAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : '—'}</p>
                <p>Latest purchase: {detail.lifetime?.lastAt ? new Date(detail.lifetime.lastAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : '—'}</p>
                <p>Average order: {formatPrice(detail.lifetime?.averageOrderValue || 0)}</p>
                <p>Favorite product: {detail.lifetime?.favoriteProduct || '—'}</p>
              </div>
              <p className="mt-2 text-xs text-gray-500">{detail.lifetime?.returning ? 'Returning customer historically.' : 'No earlier qualifying purchase before this period.'}</p>
              <div className="mt-3 space-y-3">
                {(detail.orders || []).map((order) => (
                  <div key={order.id} className="rounded-xl bg-gray-50 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold">{order.orderNumber}</p>
                      <Link href={`/account/manage/orders?orderId=${encodeURIComponent(order.orderNumber)}&dateFrom=${encodeURIComponent(range?.from || '')}&dateTo=${encodeURIComponent(range?.to || '')}`} className="text-xs font-semibold text-primary-700">Open order</Link>
                    </div>
                    <p className="text-xs text-gray-500">{order.date ? new Date(order.date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : ''} · {order.paymentStatus} · {order.status}</p>
                    {(order.items || []).map((item, index) => (
                      <div key={`${order.id}-${index}`} className="mt-2 flex gap-2 text-xs">
                        {item.image ? <img src={item.image} alt="" className="h-10 w-10 rounded object-cover" /> : <span className="h-10 w-10 rounded bg-gray-200" />}
                        <div className="min-w-0">
                          <p className="truncate font-medium">{item.title}</p>
                          <p className="text-gray-500">{item.variant || 'No variant'} · qty {item.quantity} · {formatPrice(item.price)}</p>
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
