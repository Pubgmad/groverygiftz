'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { FiBarChart2, FiRefreshCw } from 'react-icons/fi';
import { formatPrice } from '@/lib/utils';
import { DATE_PRESETS } from '@/lib/revenueAnalytics';

const STATUS_LABELS = {
  ordered: 'Ordered',
  pending: 'Ordered',
  on_process: 'On Process',
  processing: 'On Process',
  dispatched: 'Dispatched',
  shipped: 'Dispatched',
  delivered: 'Dispatched',
  cancelled: 'Cancelled',
  paid: 'Paid',
  failed: 'Failed',
  refunded: 'Refunded',
};

const CHART_COLORS = ['#2456D8', '#F47920', '#059669', '#7C3AED', '#DB2777', '#0F766E', '#CA8A04'];

function money(value) {
  return formatPrice(value || 0);
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="max-w-[220px] rounded-xl border bg-white px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-gray-900">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} style={{ color: entry.color }} className="mt-1">
          {entry.name}: {entry.dataKey === 'orders' || entry.dataKey === 'units' ? entry.value : money(entry.value)}
        </p>
      ))}
    </div>
  );
}

function Kpi({ label, value, hint }) {
  return (
    <div className="min-w-0 rounded-2xl border bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-2 break-words text-xl font-bold leading-tight text-gray-950 sm:text-2xl">{value}</p>
      {hint ? <p className="mt-1 text-xs leading-5 text-gray-500">{hint}</p> : null}
    </div>
  );
}

function Panel({ title, children, action }) {
  return (
    <section className="min-w-0 rounded-2xl border bg-white p-4 sm:p-5">
      <div className="mb-4 flex min-w-0 flex-wrap items-start justify-between gap-2">
        <h2 className="text-lg font-bold leading-tight">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function RevenueAnalyticsPage() {
  const [preset, setPreset] = useState('last30');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [granularity, setGranularity] = useState('day');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [status, setStatus] = useState('');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [product, setProduct] = useState('');
  const [collection, setCollection] = useState('');
  const [sortProducts, setSortProducts] = useState('revenue');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set('preset', preset);
    params.set('granularity', granularity);
    if (preset === 'custom') {
      if (from) params.set('from', from);
      if (to) params.set('to', to);
    }
    if (paymentMethod) params.set('paymentMethod', paymentMethod);
    if (status) params.set('status', status);
    if (state) params.set('state', state);
    if (city) params.set('city', city);
    if (product) params.set('product', product);
    if (collection) params.set('collection', collection);
    return params.toString();
  }, [preset, granularity, from, to, paymentMethod, status, state, city, product, collection]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const res = await fetch(`/api/admin/revenue?${query}`, { cache: 'no-store' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error || 'Unable to load revenue analytics');
      setLoading(false);
      return;
    }
    setData(json);
    setLoading(false);
  }, [query]);

  useEffect(() => { load(); }, [load]);

  const reset = () => {
    setPreset('last30');
    setFrom('');
    setTo('');
    setGranularity('day');
    setPaymentMethod('');
    setStatus('');
    setState('');
    setCity('');
    setProduct('');
    setCollection('');
    setSortProducts('revenue');
  };

  const kpis = data?.kpis || {};
  const products = [...(data?.products || [])].sort((a, b) => sortProducts === 'units' ? b.units - a.units : b.revenue - a.revenue);
  const hours = data?.hours || [];
  const maxHeat = Math.max(1, ...(data?.heatmap || []).flatMap((row) => row.hours.map((cell) => cell.orders)));
  const ordersHref = `/account/manage/orders?dateFrom=${encodeURIComponent(data?.range?.from || '')}&dateTo=${encodeURIComponent(data?.range?.to || '')}${status ? `&status=${encodeURIComponent(status)}` : ''}`;
  const selectClass = 'w-full min-w-0 rounded-lg border bg-white px-3 py-2.5 text-sm';

  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl space-y-4">
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-2xl font-bold leading-tight">
              <FiBarChart2 className="shrink-0 text-primary-600" /> Revenue Analytics
            </h1>
            <p className="mt-2 text-sm leading-6 text-gray-500">Paid, non-cancelled orders only. Dates and hours use Indian Standard Time. This page does not change orders.</p>
          </div>
          <Link href={ordersHref} className="inline-flex min-h-[44px] items-center rounded-xl border px-4 py-2 text-sm font-semibold text-primary-700">View matching orders</Link>
        </div>
      </div>

      <section className="min-w-0 rounded-2xl border bg-white p-4">
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm font-medium">Period
            <select value={preset} onChange={(e) => setPreset(e.target.value)} className={`mt-1 ${selectClass}`}>
              {DATE_PRESETS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          {preset === 'custom' && (
            <>
              <label className="text-sm font-medium">From
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={`mt-1 ${selectClass}`} />
              </label>
              <label className="text-sm font-medium">To
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={`mt-1 ${selectClass}`} />
              </label>
            </>
          )}
          <label className="text-sm font-medium">Trend grouping
            <select value={granularity} onChange={(e) => setGranularity(e.target.value)} className={`mt-1 ${selectClass}`}>
              <option value="day">Daily</option>
              <option value="week">Weekly</option>
              <option value="month">Monthly</option>
              <option value="year">Yearly</option>
            </select>
          </label>
          <label className="text-sm font-medium">Payment method
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className={`mt-1 ${selectClass}`}>
              <option value="">All methods</option>
              {(data?.options?.methods || []).map((method) => <option key={method} value={method}>{method}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium">Order status
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={`mt-1 ${selectClass}`}>
              <option value="">All statuses</option>
              <option value="ordered">Ordered</option>
              <option value="on_process">On Process</option>
              <option value="dispatched">Dispatched</option>
            </select>
          </label>
          <label className="text-sm font-medium">State
            <select value={state} onChange={(e) => { setState(e.target.value); setCity(''); }} className={`mt-1 ${selectClass}`}>
              <option value="">All states</option>
              {(data?.options?.states || []).map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium">City
            <select value={city} onChange={(e) => setCity(e.target.value)} className={`mt-1 ${selectClass}`}>
              <option value="">All cities</option>
              {(data?.options?.cities || []).map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium">Product
            <select value={product} onChange={(e) => setProduct(e.target.value)} className={`mt-1 ${selectClass}`}>
              <option value="">All products</option>
              {(data?.products || []).filter((item) => item.id).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium">Collection
            <select value={collection} onChange={(e) => setCollection(e.target.value)} className={`mt-1 ${selectClass}`}>
              <option value="">All collections</option>
              {(data?.options?.collections || []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
        </div>
        <button type="button" onClick={reset} className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold">
          <FiRefreshCw /> Reset filters
        </button>
        {data?.range && <p className="mt-3 text-xs leading-5 text-gray-500">Showing {data.range.from} to {data.range.to} IST. Comparison period: {data.range.previousFrom} to {data.range.previousTo}.</p>}
      </section>

      {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {loading && <p className="py-6 text-center text-sm text-gray-500">Loading analytics...</p>}

      {!loading && data && (
        <>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Collected revenue" value={money(kpis.collectedRevenue)} hint="Paid total including shipping" />
            <Kpi label="Product sales" value={money(kpis.productSales)} hint="Line items only, excludes shipping" />
            <Kpi label="Paid orders" value={kpis.paidOrders || 0} hint={`${kpis.unitsSold || 0} units sold`} />
            <Kpi label="Average order value" value={money(kpis.averageOrderValue)} hint="Collected revenue ÷ paid orders" />
            <Kpi label="Shipping collected" value={money(kpis.shippingCollected)} hint="Charged to customers, not carrier cost" />
            <Kpi label="Refunded amount" value={money(kpis.refundedAmount)} hint={`${kpis.refundedOrders || 0} refunded orders`} />
            <Kpi label="Revenue vs previous" value={kpis.revenueGrowthPct === null ? '—' : `${kpis.revenueGrowthPct}%`} hint={kpis.revenueGrowthPct === null ? 'Previous period had zero revenue' : `Previous ${money(kpis.previousCollectedRevenue)}`} />
            <Kpi label="Top product" value={kpis.topProduct?.title || '—'} hint={kpis.topProduct ? `${kpis.topProduct.units} sold · ${money(kpis.topProduct.revenue)}` : 'No paid items in this period'} />
          </div>

          <Panel title="Revenue trend">
            {data.trend.length === 0 ? <p className="text-sm text-gray-500">No paid orders in this range.</p> : (
              <div className="h-64 w-full min-w-0 sm:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={16} />
                    <YAxis tick={{ fontSize: 11 }} width={56} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend />
                    <Area type="monotone" dataKey="collected" name="Collected revenue" stroke="#2456D8" fill="#DCE7FF" />
                    <Area type="monotone" dataKey="orders" name="Orders" stroke="#F47920" fill="#FFE8CC" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </Panel>

          <div className="grid min-w-0 gap-4 xl:grid-cols-2">
            <Panel title="State-wise collected revenue">
              {data.states.length === 0 ? <p className="text-sm text-gray-500">No state data.</p> : (
                <div className="h-72 w-full min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.states.slice(0, 12)} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="label" width={90} tick={{ fontSize: 11 }} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="collected" name="Collected revenue" fill="#2456D8" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="mt-4 space-y-2">
                {data.states.slice(0, 8).map((row) => (
                  <button key={row.key} type="button" onClick={() => setState(row.label)} className="flex w-full min-w-0 items-center justify-between gap-2 rounded-xl bg-gray-50 px-3 py-2 text-left text-sm">
                    <span className="min-w-0 truncate font-medium">{row.label || 'Unknown'}</span>
                    <span className="shrink-0 text-xs text-gray-500">{row.orders} orders · {money(row.collected)} · {row.sharePct}%</span>
                  </button>
                ))}
              </div>
            </Panel>
            <Panel title="City-wise performance">
              <p className="mb-3 text-xs leading-5 text-gray-500">District is not stored on orders. These rows are cities from shipping addresses.</p>
              <div className="space-y-2">
                {data.cities.slice(0, 12).map((row) => (
                  <button key={row.key} type="button" onClick={() => { if (row.state) setState(row.state); setCity(row.label); }} className="flex w-full min-w-0 items-start justify-between gap-2 rounded-xl border px-3 py-2 text-left">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{row.label}</span>
                      <span className="text-xs text-gray-500">{row.state || 'Unknown state'}</span>
                    </span>
                    <span className="shrink-0 text-right text-xs text-gray-600">{row.orders} orders<br />{money(row.collected)}</span>
                  </button>
                ))}
                {data.cities.length === 0 && <p className="text-sm text-gray-500">No city data.</p>}
              </div>
            </Panel>
          </div>

          <Panel title="Peak payment times (IST)">
            <div className="h-64 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hours}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={2} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="orders" name="Paid orders" fill="#2456D8" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-5 overflow-x-auto">
              <p className="mb-2 text-sm font-semibold">Weekday × hour heatmap</p>
              <div className="min-w-[640px]">
                <div className="grid grid-cols-[72px_repeat(24,minmax(0,1fr))] gap-0.5 text-[10px]">
                  <span />
                  {hours.map((hour) => <span key={hour.hour} className="text-center text-gray-400">{hour.hour}</span>)}
                  {(data.heatmap || []).map((row) => (
                    <div key={row.weekday} className="contents">
                      <span className="truncate py-1 text-gray-600">{row.weekday.slice(0, 3)}</span>
                      {row.hours.map((cell) => (
                        <div
                          key={`${row.weekday}-${cell.hour}`}
                          title={`${row.weekday} ${String(cell.hour).padStart(2, '0')}:00 IST · ${cell.orders} orders · ${money(cell.collected)}`}
                          className="h-6 rounded-sm"
                          style={{ backgroundColor: `rgba(36, 86, 216, ${0.08 + (cell.orders / maxHeat) * 0.92})` }}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {(data.weekdays || []).map((row) => (
                <div key={row.weekday} className="rounded-xl bg-gray-50 px-3 py-2 text-sm">
                  <p className="font-semibold">{row.weekday}</p>
                  <p className="text-xs text-gray-500">{row.orders} orders · {money(row.collected)}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel
            title="Best-selling products"
            action={(
              <select value={sortProducts} onChange={(e) => setSortProducts(e.target.value)} className="rounded-lg border px-3 py-2 text-sm">
                <option value="revenue">By revenue</option>
                <option value="units">By quantity</option>
              </select>
            )}
          >
            <p className="mb-3 text-xs leading-5 text-gray-500">Ranked from actual order items, not the admin Best Seller flag. Historical titles and prices are kept even if a product is later edited.</p>
            <div className="space-y-3">
              {products.slice(0, 10).map((row, index) => (
                <button key={`${row.id}-${row.title}`} type="button" onClick={() => row.id && setProduct(row.id)} className="flex w-full min-w-0 items-center gap-3 rounded-2xl border p-3 text-left">
                  <span className="w-6 shrink-0 text-sm font-bold text-gray-400">{index + 1}</span>
                  {row.image ? <img src={row.image} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" /> : <span className="h-12 w-12 shrink-0 rounded-lg bg-gray-100" />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{row.title}</span>
                    <span className="text-xs text-gray-500">{row.units} sold · {row.orders} orders · avg {money(row.averagePrice)}</span>
                  </span>
                  <span className="shrink-0 text-sm font-bold">{money(row.revenue)}</span>
                </button>
              ))}
              {products.length === 0 && <p className="text-sm text-gray-500">No product sales in this period.</p>}
            </div>
          </Panel>

          {data.variants?.length > 0 && (
            <Panel title="Variant performance">
              <div className="space-y-2">
                {data.variants.slice(0, 12).map((row) => (
                  <div key={`${row.title}-${row.variant}`} className="flex min-w-0 items-center justify-between gap-2 rounded-xl bg-gray-50 px-3 py-2 text-sm">
                    <span className="min-w-0 truncate">{row.title} · {row.variant}</span>
                    <span className="shrink-0 text-xs text-gray-600">{row.units} sold · {money(row.revenue)}</span>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          <div className="grid min-w-0 gap-4 xl:grid-cols-2">
            <Panel title="Payment outcomes">
              {data.paymentOutcomes.length === 0 ? <p className="text-sm text-gray-500">No payment attempts in this date range.</p> : (
              <div className="h-64 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data.paymentOutcomes} dataKey="orders" nameKey="status" innerRadius={50} outerRadius={80} paddingAngle={2}>
                      {data.paymentOutcomes.map((row, index) => <Cell key={row.status} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              )}
              <div className="mt-2 space-y-1 text-sm">
                {data.paymentOutcomes.map((row) => (
                  <p key={row.status} className="flex justify-between gap-2"><span>{STATUS_LABELS[row.status] || row.status}</span><span>{row.orders} · {money(row.amount)}</span></p>
                ))}
                {(data.payments || []).map((row) => (
                  <p key={row.method} className="flex justify-between gap-2 text-gray-600"><span>{row.method} paid</span><span>{row.orders} · {money(row.collected)}</span></p>
                ))}
              </div>
            </Panel>
            <Panel title="Paid order status">
              <div className="h-64 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.statuses}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="status" tickFormatter={(value) => STATUS_LABELS[value] || value} tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="orders" name="Orders" fill="#F47920" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </div>

          <div className="grid min-w-0 gap-4 xl:grid-cols-2">
            <Panel title="Customers in this period">
              <div className="grid grid-cols-2 gap-3">
                <Kpi label="Unique buyers" value={data.customers?.unique || 0} />
                <Kpi label="Repeat in period" value={`${data.customers?.repeatRate || 0}%`} hint={`${data.customers?.repeatInPeriod || 0} buyers with 2+ paid orders`} />
              </div>
              <p className="mt-3 text-sm text-gray-600">Revenue from repeat buyers: {money(data.customers?.revenueFromRepeat)}</p>
              <p className="mt-2 text-xs leading-5 text-gray-500">Buyers are matched by customer account, then guest/shipping email. Phone-only guests without email are excluded from this count.</p>
            </Panel>
            <Panel title="Collection contribution">
              {data.collections?.length ? data.collections.slice(0, 8).map((row) => (
                <div key={row.id} className="flex items-center justify-between gap-2 border-b py-2 text-sm last:border-0">
                  <span className="min-w-0 truncate">{row.name}</span>
                  <span className="shrink-0 text-xs text-gray-600">{row.units} sold · {money(row.revenue)}</span>
                </div>
              )) : <p className="text-sm text-gray-500">No current collection membership on sold products.</p>}
              <p className="mt-2 text-xs leading-5 text-gray-500">A product in multiple collections is counted in each. These rows can overlap and should not be added together.</p>
            </Panel>
          </div>

          <Panel title="Insights from this period">
            <ul className="space-y-2 text-sm leading-6 text-gray-700">
              {(data.insights || []).map((note) => <li key={note} className="rounded-xl bg-primary-50/60 px-3 py-2">{note}</li>)}
            </ul>
            <div className="mt-4 space-y-1 text-xs leading-5 text-gray-500">
              {(data.limitations || []).map((note) => <p key={note}>{note}</p>)}
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
