'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { FiSearch, FiTool, FiX } from 'react-icons/fi';
import ReadOnlyBanner from '@/components/admin/ReadOnlyBanner';
import useAdminAccess from '@/hooks/useAdminAccess';
import { formatPrice } from '@/lib/utils';
import { findCostRow } from '@/lib/makingCost';
import { formatIstDateInput } from '@/lib/revenueAnalytics';
import AdminSelect from '@/components/admin/AdminSelect';

function formatMakingCostCell(product) {
  if (product.makingCost !== null && product.makingCost !== undefined) return formatPrice(product.makingCost);
  if (product.makingCostRange) {
    return `${formatPrice(product.makingCostRange.min)} – ${formatPrice(product.makingCostRange.max)}`;
  }
  return product.costStatus === 'configured' || product.costStatus === 'partial' ? 'Variant costs' : 'Unknown';
}

function statusBadge(status) {
  if (status === 'configured') return 'bg-emerald-50 text-emerald-800';
  if (status === 'partial') return 'bg-amber-50 text-amber-800';
  return 'bg-rose-50 text-rose-800';
}

function statusLabel(status) {
  if (status === 'configured') return 'Configured';
  if (status === 'partial') return 'Partial';
  return 'Not configured';
}

function unitProfit(selling, cost) {
  if (cost === null || cost === undefined || cost === '') return null;
  const sale = Number(selling || 0);
  const making = Number(cost);
  if (!Number.isFinite(making)) return null;
  return sale - making;
}

export default function MakingCostPage() {
  const { canWrite } = useAdminAccess();
  const write = canWrite('making-cost');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ products: [], pages: 1, missing: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState(null);
  const [saving, setSaving] = useState(false);
  const [productAmount, setProductAmount] = useState('');
  const [variantAmounts, setVariantAmounts] = useState({});
  const [effectiveFrom, setEffectiveFrom] = useState(formatIstDateInput());
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ search: debouncedSearch, status, page: String(page), limit: '20' });
    const res = await fetch(`/api/admin/making-cost?${params}`, { cache: 'no-store' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(json.error || 'Unable to load making costs');
      setLoading(false);
      return;
    }
    setData(json);
    setLoading(false);
  }, [page, debouncedSearch, status]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const openEditor = async (id) => {
    setSelectedId(id);
    setDetail(null);
    const res = await fetch(`/api/admin/making-cost/${id}`, { cache: 'no-store' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(json.error || 'Unable to load product cost');
      setSelectedId('');
      return;
    }
    setDetail(json);
    const productCost = findCostRow(json.costs || [], '');
    setProductAmount(productCost ? String(productCost.amount) : '');
    const next = {};
    (json.product?.variants || []).forEach((variant) => {
      const cost = findCostRow(json.costs || [], variant.variantKey);
      next[variant.variantKey] = cost ? String(cost.amount) : '';
    });
    setVariantAmounts(next);
    const hasExistingCost = Array.isArray(json.costs) && json.costs.length > 0;
    // First-ever cost is applied from product creation on the server; later changes use this date.
    setEffectiveFrom(hasExistingCost
      ? formatIstDateInput()
      : formatIstDateInput(json.product?.createdAt ? new Date(json.product.createdAt) : new Date()));
    setNote('');
  };

  const save = async () => {
    if (!selectedId || !write) return;
    setSaving(true);
    const res = await fetch(`/api/admin/making-cost/${selectedId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productAmount,
        variants: (detail?.product?.variants || []).map((variant) => ({
          variantName: variant.variantName,
          optionLabel: variant.optionLabel,
          amount: variantAmounts[variant.variantKey],
        })),
        effectiveFrom,
        note,
      }),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      toast.error(json.error || 'Unable to save making cost');
      return;
    }
    toast.success('Making cost saved');
    setDetail(json);
    load();
  };

  const missingLabel = useMemo(() => `${data.missing || 0} product${data.missing === 1 ? '' : 's'} still missing a complete making cost`, [data.missing]);

  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl">
      <ReadOnlyBanner show={!write} />
      <div className="mb-6 min-w-0">
        <h1 className="flex items-center gap-2 text-2xl font-bold leading-tight">
          <FiTool className="shrink-0 text-primary-600" /> Making Cost
        </h1>
        <p className="mt-2 text-sm leading-6 text-gray-500">
          Costs are stored separately from product editing. A missing cost is unknown, never ₹0. Saving records the date the cost starts applying so later changes do not rewrite earlier profit.
        </p>
      </div>

      <div className="mb-4 grid min-w-0 gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-[minmax(0,1fr)_13rem]">
        <label className="relative block min-w-0">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by product name or ID"
            className="min-h-[44px] w-full rounded-lg border py-2 pl-10 pr-3 text-sm"
          />
        </label>
        <AdminSelect
          value={status}
          onChange={(next) => { setStatus(next); setPage(1); }}
          options={[
            { value: 'all', label: 'All products' },
            { value: 'missing', label: 'Not configured' },
            { value: 'partial', label: 'Partial' },
            { value: 'configured', label: 'Configured' },
          ]}
        />
        <p className="text-sm leading-5 text-gray-500 sm:col-span-2">{missingLabel}</p>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-white">
        {loading ? <p className="p-6 text-center text-sm text-gray-500">Loading products...</p> : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-gray-600">
                    <th className="p-4">Product</th>
                    <th className="p-4">Selling price</th>
                    <th className="p-4">Making cost</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Updated</th>
                    <th className="p-4">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.products.map((product) => (
                    <tr key={product.id} className="border-t">
                      <td className="p-4">
                        <div className="flex min-w-0 items-center gap-3">
                          {product.image ? <img src={product.image} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" /> : <span className="h-12 w-12 shrink-0 rounded-lg bg-gray-100" />}
                          <div className="min-w-0">
                            <p className="truncate font-semibold">{product.title}</p>
                            <p className="text-xs text-gray-500">{product.id}</p>
                            <p className="text-xs text-gray-500">{product.collections.join(', ') || 'No collection'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <p>{formatPrice(product.salePrice > 0 && product.salePrice < product.regularPrice ? product.salePrice : product.regularPrice)}</p>
                        {product.salePrice > 0 && product.salePrice < product.regularPrice ? <p className="text-xs text-gray-500">Regular {formatPrice(product.regularPrice)}</p> : null}
                      </td>
                      <td className="p-4">{formatMakingCostCell(product)}</td>
                      <td className="p-4"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusBadge(product.costStatus)}`}>{statusLabel(product.costStatus)}</span></td>
                      <td className="p-4 text-xs text-gray-500">{product.lastUpdated ? new Date(product.lastUpdated).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '—'}</td>
                      <td className="p-4">
                        <button type="button" onClick={() => openEditor(product.id)} className="min-h-[44px] rounded-lg border px-3 font-semibold text-primary-700">Edit</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-3 p-3 md:hidden">
              {data.products.map((product) => (
                <button key={product.id} type="button" onClick={() => openEditor(product.id)} className="w-full rounded-2xl border p-3 text-left">
                  <div className="flex gap-3">
                    {product.image ? <img src={product.image} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" /> : <span className="h-14 w-14 shrink-0 rounded-lg bg-gray-100" />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold leading-5">{product.title}</p>
                      <p className="mt-1 text-xs leading-5 text-gray-500">{statusLabel(product.costStatus)} · {formatMakingCostCell(product)}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            {data.products.length === 0 && <p className="p-6 text-center text-sm text-gray-500">No products match these filters.</p>}
          </>
        )}
      </div>

      {data.pages > 1 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {Array.from({ length: data.pages }, (_, index) => (
            <button key={index} type="button" onClick={() => setPage(index + 1)} className={`min-h-[40px] min-w-[40px] rounded-lg border px-3 text-sm ${page === index + 1 ? 'bg-primary-600 text-white' : ''}`}>
              {index + 1}
            </button>
          ))}
        </div>
      )}

      {selectedId && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-center sm:justify-center">
          <div className="flex h-[92dvh] max-h-[92dvh] w-full min-w-0 flex-col overflow-hidden rounded-t-3xl bg-white pb-[env(safe-area-inset-bottom)] sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:rounded-3xl sm:pb-0">
            <div className="flex shrink-0 items-start justify-between gap-3 border-b p-4 sm:p-6 sm:pb-4">
              <div className="min-w-0 flex-1">
                <h2 className="break-words text-lg font-bold leading-tight">{detail?.product?.title || 'Making cost'}</h2>
                <p className="mt-1 break-all text-xs text-gray-500">{detail?.product?.id || selectedId}</p>
              </div>
              <button type="button" onClick={() => setSelectedId('')} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border" aria-label="Close">
                <FiX />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 sm:pt-4">
            {!detail ? <p className="text-sm text-gray-500">Loading...</p> : (
              <div className="space-y-4">
                <label className="block text-sm font-medium">Product making cost
                  <input type="number" min="0" step="0.01" value={productAmount} onChange={(e) => setProductAmount(e.target.value)} disabled={!write} className="mt-1 min-h-[44px] w-full rounded-lg border px-3" />
                </label>
                {detail.product.variants.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-sm font-semibold">Variant making costs</p>
                    {detail.product.variants.map((variant) => {
                      const profit = unitProfit(variant.salePrice > 0 && variant.salePrice < variant.regularPrice ? variant.salePrice : variant.regularPrice, variantAmounts[variant.variantKey]);
                      return (
                        <label key={variant.variantKey} className="block rounded-xl border p-3 text-sm">
                          <span className="break-words font-medium">{variant.variantName}: {variant.optionLabel}</span>
                          <span className="mt-1 block text-xs text-gray-500">Selling {formatPrice(variant.salePrice > 0 && variant.salePrice < variant.regularPrice ? variant.salePrice : variant.regularPrice)}</span>
                          <input type="number" min="0" step="0.01" value={variantAmounts[variant.variantKey] || ''} onChange={(e) => setVariantAmounts((prev) => ({ ...prev, [variant.variantKey]: e.target.value }))} disabled={!write} className="mt-2 min-h-[44px] w-full rounded-lg border px-3" />
                          <span className="mt-1 block text-xs text-gray-500">{profit === null ? 'Gross profit unknown until this cost is saved' : `Unit gross profit at current listed price: ${formatPrice(profit)}`}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
                <label className="block text-sm font-medium">Applies from (IST)
                  <input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} disabled={!write || !(detail.costs || []).length} className="mt-1 min-h-[44px] w-full rounded-lg border px-3" />
                </label>
                <label className="block text-sm font-medium">Note
                  <input value={note} onChange={(e) => setNote(e.target.value)} disabled={!write} placeholder="Optional reason for this change" className="mt-1 min-h-[44px] w-full rounded-lg border px-3" />
                </label>
                <p className="text-xs leading-5 text-gray-500">
                  {(detail.costs || []).length
                    ? 'Updating an existing cost uses the date above for when the new amount starts. Earlier history rows stay in place. New paid orders snapshot the current cost at checkout. Blank fields are left unchanged.'
                    : 'The first making cost for each product or variant applies from the product creation date so past paid orders in analytics are covered. Choose a later “Applies from” date only when you change an existing cost. Blank fields are left unchanged.'}
                </p>
                {write && (
                  <button type="button" onClick={save} disabled={saving} className="min-h-[44px] w-full rounded-xl bg-primary-600 font-semibold text-white disabled:opacity-60">
                    {saving ? 'Saving...' : 'Save making cost'}
                  </button>
                )}
                <div>
                  <p className="mb-2 text-sm font-semibold">Cost history</p>
                  {detail.history?.length ? detail.history.map((row, index) => (
                    <p key={`${row.variantKey}-${row.effectiveFrom}-${index}`} className="break-words border-b py-2 text-xs leading-5 text-gray-600 last:border-0">
                      {row.variantKey || 'Product'}: {formatPrice(row.amount)}
                      {row.previousAmount === null ? '' : ` (was ${formatPrice(row.previousAmount)})`}
                      {' · from '}
                      {new Date(row.effectiveFrom).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                      {row.updatedByEmail ? ` · ${row.updatedByEmail}` : ''}
                      {row.note ? ` · ${row.note}` : ''}
                    </p>
                  )) : <p className="text-sm text-gray-500">No cost history yet.</p>}
                </div>
              </div>
            )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
