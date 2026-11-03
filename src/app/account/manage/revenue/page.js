'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import {
  DATE_PRESETS,
  cityStateKey,
  formatCityStateLabel,
  formatIstDateInput,
  parseCityStateKey,
  presetToRange,
  previousEquivalentRange,
  shiftIstDate,
} from '@/lib/revenueAnalytics';
import BuyerDrillDown from '@/components/admin/BuyerDrillDown';
import AdminSelect from '@/components/admin/AdminSelect';

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

function Kpi({ label, value, hint, onClick }) {
  const className = `min-w-0 rounded-2xl border bg-white p-4 text-left ${onClick ? 'cursor-pointer hover:border-primary-300 hover:shadow-sm' : ''}`;
  const inner = (
    <>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-2 break-words text-xl font-bold leading-tight text-gray-950 sm:text-2xl">{value}</p>
      {hint ? <p className="mt-1 text-xs leading-5 text-gray-500">{hint}</p> : null}
    </>
  );
  if (onClick) {
    return <button type="button" onClick={onClick} className={`w-full ${className}`}>{inner}</button>;
  }
  return <div className={className}>{inner}</div>;
}

function Panel({ title, children, action }) {
  return (
    <section className="min-w-0 rounded-2xl border bg-white p-4 sm:p-5">
      <div className="mb-4 flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <h2 className="text-lg font-bold leading-tight">{title}</h2>
        {action ? <div className="w-full min-w-0 sm:w-auto">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

const EMPTY_FILTER_OPTIONS = { states: [], cities: [], methods: [], products: [], collections: [], variants: [] };
const selectClass = 'w-full min-w-0 rounded-lg border bg-white px-3 py-2.5 text-sm';

function FilterSelect({ label, value, onChange, placeholder, loadingLabel, options, loading }) {
  const emptyLabel = loading ? loadingLabel : placeholder;
  const selectOptions = loading
    ? [{ value: '', label: emptyLabel }]
    : [{ value: '', label: emptyLabel }, ...options];
  return (
    <label className="block min-w-0 text-sm font-medium">{label}
      <AdminSelect
        className="mt-1"
        value={loading ? '' : value}
        onChange={loading ? () => {} : onChange}
        placeholder={emptyLabel}
        options={selectOptions}
      />
    </label>
  );
}

function preferOptionLabel(options, label) {
  const raw = String(label || '').trim();
  if (!raw) return '';
  const hit = (options || []).find((item) => String(item).toLowerCase() === raw.toLowerCase());
  return hit || raw;
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
  const [variant, setVariant] = useState('');
  const [buyerKind, setBuyerKind] = useState('');
  const [profitProduct, setProfitProduct] = useState(null);
  const [sortProducts, setSortProducts] = useState('revenue');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterOptions, setFilterOptions] = useState(EMPTY_FILTER_OPTIONS);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsReady, setOptionsReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const hasLoadedRef = useRef(false);
  const loadSeqRef = useRef(0);

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
    if (variant) params.set('variant', variant);
    return params.toString();
  }, [preset, granularity, from, to, paymentMethod, status, state, city, product, collection, variant]);

  const optionsQuery = useMemo(() => {
    const params = new URLSearchParams();
    params.set('preset', preset);
    params.set('optionsOnly', '1');
    if (preset === 'custom') {
      if (from) params.set('from', from);
      if (to) params.set('to', to);
    }
    if (state) params.set('state', state);
    if (product) params.set('product', product);
    if (collection) params.set('collection', collection);
    return params.toString();
  }, [preset, from, to, state, product, collection]);

  const applyOptions = useCallback((next) => {
    if (!next) return;
    setFilterOptions({
      states: next.states || [],
      cities: next.cities || [],
      methods: next.methods || [],
      products: next.products || [],
      collections: next.collections || [],
      variants: next.variants || [],
    });
  }, []);

  const load = useCallback(async () => {
    const seq = ++loadSeqRef.current;
    if (!hasLoadedRef.current) setLoading(true);
    else {
      setRefreshing(true);
      // Drop previous charts immediately so a new period/filter cannot keep showing
      // stale KPI/graph totals under an already-updated "Showing …" date line.
      setData(null);
    }
    setError('');
    try {
      const res = await fetch(`/api/admin/revenue?${query}`, { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (seq !== loadSeqRef.current) return;
      if (!res.ok) {
        setError(json.error || 'Unable to load revenue analytics');
        setData(null);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      setData(json);
      applyOptions(json.options);
      setOptionsReady(true);
      hasLoadedRef.current = true;
      setLoading(false);
      setRefreshing(false);
    } catch {
      if (seq !== loadSeqRef.current) return;
      setError('Unable to load revenue analytics');
      setData(null);
      setLoading(false);
      setRefreshing(false);
    }
  }, [applyOptions, query]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let cancelled = false;
    setOptionsLoading(true);
    setOptionsReady(false);
    setFilterOptions(EMPTY_FILTER_OPTIONS);
    (async () => {
      try {
        const res = await fetch(`/api/admin/revenue?${optionsQuery}`, { cache: 'no-store' });
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setOptionsLoading(false);
          return;
        }
        applyOptions(json.options);
        setOptionsReady(true);
        setOptionsLoading(false);
      } catch {
        if (!cancelled) setOptionsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [applyOptions, optionsQuery]);

  // Drop stale selections that are no longer in the scoped option lists
  // (including when the scoped list is empty — otherwise the UI shows "All …"
  // while the hidden value still filters the API).
  useEffect(() => {
    if (optionsLoading || !optionsReady) return;
    if (paymentMethod && !filterOptions.methods.some((m) => m.toLowerCase() === paymentMethod.toLowerCase())) {
      setPaymentMethod('');
    }
    if (state && !filterOptions.states.some((s) => s.toLowerCase() === state.toLowerCase())) {
      setState('');
      setCity('');
    }
    if (city) {
      const matches = (filterOptions.cities || []).filter((entry) => {
        const cityName = typeof entry === 'string' ? entry : entry.city;
        const stateName = typeof entry === 'string' ? '' : (entry.state || '');
        if (String(cityName || '').toLowerCase() !== city.toLowerCase()) return false;
        if (state) return String(stateName || '').toLowerCase() === state.toLowerCase();
        return true;
      });
      if (!matches.length) {
        setCity('');
      } else if (!state && matches.length === 1) {
        const only = matches[0];
        const onlyState = typeof only === 'string' ? '' : (only.state || '');
        if (onlyState) setState(preferOptionLabel(filterOptions.states, onlyState) || onlyState);
      } else if (!state && matches.length > 1) {
        // Ambiguous city name across states — require an explicit city|state choice.
        setCity('');
      }
    }
    if (product && !filterOptions.products.some((p) => p.id === product)) {
      setProduct('');
      setVariant('');
    }
    if (variant && !filterOptions.variants.some((v) => v.toLowerCase() === variant.toLowerCase())) {
      setVariant('');
    }
  }, [optionsLoading, optionsReady, filterOptions, paymentMethod, state, city, product, variant]);

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
    setVariant('');
    setSortProducts('revenue');
    setProfitProduct(null);
  };

  const activeFilters = [
    preset !== 'last30' ? DATE_PRESETS.find((item) => item.id === preset)?.label || preset : null,
    paymentMethod || null,
    status || null,
    state || null,
    city ? formatCityStateLabel(city, state) : null,
    product ? (filterOptions.products.find((p) => p.id === product)?.title || 'Product') : null,
    collection ? (filterOptions.collections.find((c) => c.id === collection)?.name || 'Collection') : null,
    variant || null,
  ].filter(Boolean);

  // Always derive the intended IST range from the current filter controls so the
  // "Showing …" line never lags behind the Period dropdown after a failed request.
  const selectedRange = useMemo(() => {
    if (preset === 'custom') return presetToRange('custom', from, to);
    return presetToRange(preset);
  }, [preset, from, to]);
  const selectedPrevious = selectedRange
    ? previousEquivalentRange(selectedRange.fromStr, selectedRange.toStr)
    : null;
  const shownFrom = selectedRange?.fromStr || data?.range?.from || '';
  const shownTo = selectedRange?.toStr || data?.range?.to || '';
  const shownPrevFrom = selectedPrevious?.fromStr || data?.range?.previousFrom || '';
  const shownPrevTo = selectedPrevious?.toStr || data?.range?.previousTo || '';

  const kpis = data?.kpis || {};
  const products = [...(data?.products || [])].sort((a, b) => sortProducts === 'units' ? b.units - a.units : b.revenue - a.revenue);
  const hours = data?.hours || [];
  const heatOrders = (data?.heatmap || []).flatMap((row) => row.hours.map((cell) => cell.orders));
  const totalHeatOrders = heatOrders.reduce((sum, n) => sum + Number(n || 0), 0);
  const maxHeat = Math.max(1, ...heatOrders);
  const hasPeakOrders = hours.some((row) => Number(row.orders || 0) > 0);
  const ordersHref = `/account/manage/orders?dateFrom=${encodeURIComponent(shownFrom)}&dateTo=${encodeURIComponent(shownTo)}${status ? `&status=${encodeURIComponent(status)}` : ''}`;
  const methodOptions = (filterOptions.methods || []).map((method) => ({ value: method, label: method }));
  const stateOptions = (filterOptions.states || []).map((item) => ({ value: item, label: item }));
  const cityOptions = (filterOptions.cities || []).map((item) => {
    if (typeof item === 'string') return { value: cityStateKey(item, state), label: item };
    return {
      value: item.value || cityStateKey(item.city, item.state),
      label: item.label || formatCityStateLabel(item.city, item.state, { includeState: !state }),
    };
  });
  const citySelectValue = city ? cityStateKey(city, state) : '';
  const productOptions = (filterOptions.products || []).filter((item) => item.id).map((item) => ({ value: item.id, label: item.title }));
  const collectionOptions = (filterOptions.collections || []).map((item) => ({ value: item.id, label: item.name }));
  const variantOptions = (filterOptions.variants || []).map((item) => ({ value: item, label: item }));

  const applyCitySelection = (next) => {
    if (!next) {
      setCity('');
      return;
    }
    const parsed = parseCityStateKey(next);
    setCity(parsed.city);
    if (parsed.state) {
      setState(preferOptionLabel(filterOptions.states, parsed.state) || parsed.state);
    }
  };

  const applyCityFromChart = (cityLabel, stateLabel = '') => {
    const cityName = String(cityLabel || '').trim();
    const stateName = String(stateLabel || '').trim();
    const match = (filterOptions.cities || []).find((entry) => {
      const entryCity = typeof entry === 'string' ? entry : entry.city;
      const entryState = typeof entry === 'string' ? '' : (entry.state || '');
      if (String(entryCity || '').toLowerCase() !== cityName.toLowerCase()) return false;
      if (!stateName) return true;
      return String(entryState || '').toLowerCase() === stateName.toLowerCase();
    });
    if (match && typeof match !== 'string') {
      setCity(match.city);
      if (match.state) setState(preferOptionLabel(filterOptions.states, match.state) || match.state);
      return;
    }
    if (stateName) setState(preferOptionLabel(filterOptions.states, stateName) || stateName);
    setCity(cityName);
  };

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
          <label className="block min-w-0 text-sm font-medium">Period
            <AdminSelect
              className="mt-1"
              value={preset}
              onChange={(next) => {
                if (next === 'custom') {
                  const today = formatIstDateInput();
                  setFrom(shiftIstDate(today, -29));
                  setTo(today);
                }
                setPreset(next);
              }}
              options={DATE_PRESETS.map((item) => ({ value: item.id, label: item.label }))}
            />
          </label>
          {preset === 'custom' && (
            <>
              <label className="min-w-0 text-sm font-medium">From
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={`mt-1 ${selectClass}`} />
              </label>
              <label className="min-w-0 text-sm font-medium">To
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={`mt-1 ${selectClass}`} />
              </label>
            </>
          )}
          <label className="block min-w-0 text-sm font-medium">Trend grouping
            <AdminSelect
              className="mt-1"
              value={granularity}
              onChange={setGranularity}
              options={[
                { value: 'day', label: 'Daily' },
                { value: 'week', label: 'Weekly' },
                { value: 'month', label: 'Monthly' },
                { value: 'year', label: 'Yearly' },
              ]}
            />
          </label>
          <FilterSelect
            label="Payment method"
            value={paymentMethod}
            onChange={setPaymentMethod}
            placeholder="All methods"
            loadingLabel="Loading methods…"
            options={methodOptions}
            loading={optionsLoading}
          />
          <label className="block min-w-0 text-sm font-medium">Order status
            <AdminSelect
              className="mt-1"
              value={status}
              onChange={setStatus}
              options={[
                { value: '', label: 'All statuses' },
                { value: 'ordered', label: 'Ordered (paid)' },
                { value: 'on_process', label: 'On Process' },
                { value: 'dispatched', label: 'Dispatched' },
              ]}
            />
          </label>
          <FilterSelect
            label="State"
            value={state}
            onChange={(next) => { setState(next); setCity(''); }}
            placeholder="All states"
            loadingLabel="Loading states…"
            options={stateOptions}
            loading={optionsLoading}
          />
          <FilterSelect
            label="City"
            value={citySelectValue}
            onChange={applyCitySelection}
            placeholder="All cities"
            loadingLabel="Loading cities…"
            options={cityOptions}
            loading={optionsLoading}
          />
          <FilterSelect
            label="Product"
            value={product}
            onChange={(next) => { setProduct(next); setVariant(''); }}
            placeholder="All products"
            loadingLabel="Loading products…"
            options={productOptions}
            loading={optionsLoading}
          />
          <FilterSelect
            label="Collection"
            value={collection}
            onChange={(next) => { setCollection(next); setProduct(''); setVariant(''); }}
            placeholder="All collections"
            loadingLabel="Loading collections…"
            options={collectionOptions}
            loading={optionsLoading}
          />
          <FilterSelect
            label="Variant"
            value={variant}
            onChange={setVariant}
            placeholder="All variants"
            loadingLabel="Loading variants…"
            options={variantOptions}
            loading={optionsLoading}
          />
        </div>
        <div className="mt-4 flex min-w-0 flex-wrap items-center gap-2">
          <button type="button" onClick={reset} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold">
            <FiRefreshCw /> Reset filters
          </button>
          {refreshing ? <span className="text-xs font-medium text-primary-700">Updating analytics…</span> : null}
        </div>
        {activeFilters.length > 0 && (
          <p className="mt-3 text-xs leading-5 text-gray-600">
            Active filters: {activeFilters.join(' · ')}
          </p>
        )}
        {shownFrom && shownTo ? (
          <p className="mt-3 text-xs leading-5 text-gray-500">
            Showing {shownFrom} to {shownTo} IST.
            {shownPrevFrom && shownPrevTo ? ` Comparison period: ${shownPrevFrom} to ${shownPrevTo}.` : ''}
            {' '}Trend grouping ({granularity}) only changes chart buckets, not which orders are included.
          </p>
        ) : null}
      </section>

      {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {(loading || (refreshing && !data)) && (
        <p className="py-6 text-center text-sm text-gray-500">Loading analytics...</p>
      )}

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

          <Panel title="Product gross profit">
            <p className="mb-4 text-xs leading-5 text-gray-500">This is product gross profit from actual order-item prices minus applicable making cost. It is not net business profit. Shipping, payment fees, packaging, taxes, marketing, and operating expenses are not stored. Missing making cost is unknown, never ₹0.</p>
            <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Kpi label="Product sales" value={money(kpis.productSales)} hint="Line-item revenue, excludes shipping" />
              <Kpi label="Known making cost" value={money(kpis.makingCostKnown)} hint={`${kpis.costCoveragePct || 0}% cost coverage · ${money(kpis.knownCostRevenue || 0)} revenue with known cost`} />
              <Kpi label="Profit on cost-covered sales" value={kpis.knownCostRevenue || kpis.productGrossProfit ? money(kpis.productGrossProfit) : 'Unavailable'} hint={kpis.profitComplete ? 'All sold items have a known making cost' : `Excludes ${money(kpis.unknownCostRevenue)} unknown-cost revenue`} />
              <Kpi label="Margin on cost-covered sales" value={kpis.grossMarginPct === null || kpis.grossMarginPct === undefined ? '—' : `${kpis.grossMarginPct}%`} hint="Profit ÷ revenue with known making cost only" />
              <Kpi label="Avg gross profit / order" value={money(kpis.averageGrossProfitPerOrder)} hint="Cost-covered profit ÷ all paid orders in range" />
              <Kpi label="Profit vs previous" value={kpis.profitGrowthPct === null ? '—' : `${kpis.profitGrowthPct}%`} hint={kpis.profitGrowthPct === null ? 'Previous period had zero known gross profit' : `Previous ${money(kpis.previousProductGrossProfit)}`} />
              <Kpi label="Most profitable product" value={kpis.mostProfitableProduct?.title || '—'} hint={kpis.mostProfitableProduct ? money(kpis.mostProfitableProduct.grossProfit) : 'Needs known making cost'} onClick={() => kpis.mostProfitableProduct && setProfitProduct({ id: kpis.mostProfitableProduct.id || '', title: kpis.mostProfitableProduct.title })} />
              <Kpi label="Least profitable product" value={kpis.leastProfitableProduct?.title || '—'} hint={kpis.leastProfitableProduct ? money(kpis.leastProfitableProduct.grossProfit) : 'Needs known making cost'} />
              <Kpi label="Unknown-cost units" value={kpis.unknownCostUnits || 0} hint="Units whose making cost is unknown" />
            </div>
          </Panel>

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
                    <Area type="monotone" dataKey="grossProfit" name="Profit on cost-covered sales" stroke="#059669" fill="#D1FAE5" />
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
                  <button
                    key={row.key}
                    type="button"
                    onClick={() => setState(preferOptionLabel(filterOptions.states, row.label))}
                    className="flex w-full min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1 rounded-xl bg-gray-50 px-3 py-2 text-left text-sm"
                  >
                    <span className="min-w-0 truncate font-medium">{row.label || 'Unknown'}</span>
                    <span className="text-xs leading-5 text-gray-500">{row.orders} orders · {money(row.collected)} · {row.sharePct}%</span>
                  </button>
                ))}
              </div>
            </Panel>
            <Panel title="City-wise performance">
              <p className="mb-3 text-xs leading-5 text-gray-500">District is not stored on orders. These rows are cities from shipping addresses.</p>
              <div className="space-y-2">
                {data.cities.slice(0, 12).map((row) => (
                  <button
                    key={row.key}
                    type="button"
                    onClick={() => applyCityFromChart(row.label, row.state)}
                    className="flex w-full min-w-0 flex-wrap items-start justify-between gap-2 rounded-xl border px-3 py-2 text-left"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{row.label}</span>
                      <span className="text-xs text-gray-500">{row.state || 'Unknown state'}</span>
                    </span>
                    <span className="text-right text-xs leading-5 text-gray-600">{row.orders} orders<br />{money(row.collected)}</span>
                  </button>
                ))}
                {data.cities.length === 0 && <p className="text-sm text-gray-500">No city data.</p>}
              </div>
            </Panel>
          </div>

          <Panel title="Peak payment times (IST)">
            {!hasPeakOrders ? (
              <p className="text-sm text-gray-500">No paid orders in this range for peak-hour charts.</p>
            ) : (
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
            )}
            <div className="mt-5 overflow-x-auto">
              <p className="mb-2 text-sm font-semibold">Weekday × hour heatmap</p>
              {totalHeatOrders === 0 ? (
                <p className="text-sm text-gray-500">No paid orders to plot on the heatmap.</p>
              ) : (
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
                          style={{ backgroundColor: cell.orders ? `rgba(36, 86, 216, ${0.08 + (cell.orders / maxHeat) * 0.92})` : 'transparent' }}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
              )}
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

          <Panel title="Revenue vs making cost vs profit">
            {data.trend.length === 0 ? <p className="text-sm text-gray-500">No paid orders in this range.</p> : (
              <div className="h-64 w-full min-w-0 sm:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={16} />
                    <YAxis tick={{ fontSize: 11 }} width={56} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend />
                    <Bar dataKey="productSales" name="Product sales" fill="#2456D8" />
                    <Bar dataKey="makingCost" name="Known making cost" fill="#F47920" />
                    <Bar dataKey="grossProfit" name="Profit on cost-covered sales" fill="#059669" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            {kpis.peakProfitDay?.label ? <p className="mt-3 text-sm text-gray-600">Highest-profit bucket in this grouping: {kpis.peakProfitDay.label} · {money(kpis.peakProfitDay.grossProfit)}</p> : null}
          </Panel>

          <Panel
            title="Best-selling products"
            action={(
              <AdminSelect
                className="w-full sm:w-44"
                value={sortProducts}
                onChange={setSortProducts}
                buttonClassName="min-h-[40px] py-2"
                options={[
                  { value: 'revenue', label: 'By revenue' },
                  { value: 'units', label: 'By quantity' },
                ]}
              />
            )}
          >
            <p className="mb-3 text-xs leading-5 text-gray-500">Ranked from actual order items, not the admin Best Seller flag. Historical titles and prices are kept even if a product is later edited.</p>
            <div className="space-y-3">
              {products.slice(0, 10).map((row, index) => (
                <button key={`${row.id}-${row.title}`} type="button" onClick={() => setProfitProduct({ id: row.id || '', title: row.title })} className="flex w-full min-w-0 items-start gap-3 rounded-2xl border p-3 text-left sm:items-center">
                  <span className="w-6 shrink-0 pt-1 text-sm font-bold text-gray-400 sm:pt-0">{index + 1}</span>
                  {row.image ? <img src={row.image} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" /> : <span className="h-12 w-12 shrink-0 rounded-lg bg-gray-100" />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{row.title}</span>
                    <span className="block text-xs leading-5 text-gray-500">{row.units} sold · {row.orders} orders · avg {money(row.averagePrice)}{row.profitKnown && row.marginPct !== null && row.marginPct !== undefined ? ` · margin ${row.marginPct}% on covered` : ''}{row.costCoveragePct !== null && row.costCoveragePct !== undefined && row.costCoveragePct < 100 ? ` · ${row.costCoveragePct}% cost coverage` : ''}</span>
                    <span className="mt-1 block text-sm font-bold sm:hidden">{money(row.revenue)}<span className={`ml-2 text-xs font-medium ${row.profitKnown ? 'text-emerald-700' : 'text-amber-700'}`}>{row.profitKnown ? `${money(row.grossProfit)} on covered` : 'Profit unknown'}</span></span>
                  </span>
                  <span className="hidden shrink-0 text-right text-sm font-bold sm:block">{money(row.revenue)}<span className={`block text-xs font-medium ${row.profitKnown ? 'text-emerald-700' : 'text-amber-700'}`}>{row.profitKnown ? `${money(row.grossProfit)} on covered` : 'Profit unknown'}</span></span>
                </button>
              ))}
              {products.length === 0 && <p className="text-sm text-gray-500">No product sales in this period.</p>}
            </div>
          </Panel>

          {data.variants?.length > 0 && (
            <Panel title="Variant performance">
              <div className="space-y-2">
                {data.variants.slice(0, 12).map((row) => (
                  <div key={`${row.title}-${row.variant}`} className="flex min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1 rounded-xl bg-gray-50 px-3 py-2 text-sm">
                    <span className="min-w-0 break-words">{row.title} · {row.variant}</span>
                    <span className="text-xs leading-5 text-gray-600">{row.units} sold · {money(row.revenue)}{row.profitKnown ? ` · ${money(row.grossProfit)} on covered` : ' · profit unknown'}</span>
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
                  <p key={row.status} className="flex min-w-0 flex-wrap justify-between gap-x-2 gap-y-1"><span>{STATUS_LABELS[row.status] || row.status}</span><span>{row.orders} · {money(row.amount)}</span></p>
                ))}
                {(data.payments || []).map((row) => (
                  <p key={row.method} className="flex min-w-0 flex-wrap justify-between gap-x-2 gap-y-1 text-gray-600"><span className="min-w-0 break-words">{row.method} paid</span><span>{row.orders} · {money(row.collected)}</span></p>
                ))}
              </div>
            </Panel>
            <Panel title="Paid order status">
              {!data.statuses?.length ? (
                <p className="text-sm text-gray-500">No paid orders in this range.</p>
              ) : (
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
              )}
            </Panel>
          </div>

          <div className="grid min-w-0 gap-4 xl:grid-cols-2">
            <Panel title="Customers in this period">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Kpi label="Unique buyers" value={data.customers?.unique || 0} hint="Click to see who they are" onClick={() => setBuyerKind('unique')} />
                <Kpi label="Repeat in period" value={data.customers?.repeatInPeriod || 0} hint={`${data.customers?.repeatRate || 0}% of unique buyers · two or more orders in this range`} onClick={() => setBuyerKind('repeat')} />
                <Kpi label="Returning buyers" value={data.customers?.returningInPeriod || 0} hint="Purchased in this range and also before it" onClick={() => setBuyerKind('returning')} />
              </div>
              <p className="mt-3 text-sm text-gray-600">Revenue from repeat buyers in period: {money(data.customers?.revenueFromRepeat)}</p>
              <p className="mt-2 text-xs leading-5 text-gray-500">Unique buyers use the customer account, then email. Repeat buyers in period are not the same as returning buyers. Phone-only records without email are excluded.</p>
            </Panel>
            <Panel title="Collection contribution">
              {data.collections?.length ? data.collections.slice(0, 8).map((row) => (
                <div key={row.id} className="flex min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1 border-b py-2 text-sm last:border-0">
                  <span className="min-w-0 truncate">{row.name}</span>
                  <span className="text-xs leading-5 text-gray-600">{row.units} sold · {money(row.revenue)}</span>
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
          {profitProduct && (
            <div className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-center sm:justify-center">
              <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-w-lg sm:rounded-3xl sm:p-6" role="dialog" aria-modal="true" aria-label="Product analytics detail">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <h2 className="min-w-0 break-words text-lg font-bold leading-tight">{profitProduct.title}</h2>
                  <button type="button" onClick={() => setProfitProduct(null)} className="inline-flex h-11 shrink-0 items-center rounded-lg border px-3">Close</button>
                </div>
                {(products.filter((row) => (profitProduct.id && row.id === profitProduct.id) || row.title === profitProduct.title)[0]
                  ? [products.filter((row) => (profitProduct.id && row.id === profitProduct.id) || row.title === profitProduct.title)[0]]
                  : []).map((row) => (
                  <div key={row.id || row.title} className="space-y-2 text-sm leading-6">
                    <p>Units sold: {row.units}</p>
                    <p>Revenue: {money(row.revenue)}</p>
                    <p>Revenue with known making cost: {money(row.knownRevenue)}</p>
                    <p>Known making cost: {row.profitKnown ? money(row.makingCost) : 'Not configured for these sales'}</p>
                    <p>Profit on cost-covered sales: {row.profitKnown ? money(row.grossProfit) : 'Unavailable until making cost is configured'}</p>
                    <p>Margin on cost-covered sales: {row.profitKnown && row.marginPct !== null && row.marginPct !== undefined ? `${row.marginPct}%` : 'Unavailable'}</p>
                    <p>Unknown-cost revenue: {money(row.unknownRevenue)}</p>
                    <p>Cost coverage: {row.costCoveragePct === null || row.costCoveragePct === undefined ? '—' : `${row.costCoveragePct}%`}</p>
                    {row.costCoveragePct !== null && row.costCoveragePct !== undefined && row.costCoveragePct < 100 ? (
                      <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
                        Profit and margin use only the {row.costCoveragePct}% of revenue with a known making cost. The remaining {money(row.unknownRevenue)} is excluded from profit — it is not treated as zero-cost.
                      </p>
                    ) : null}
                    <button type="button" onClick={() => { if (row.id) setProduct(row.id); setProfitProduct(null); }} className="mt-3 min-h-[44px] w-full rounded-xl border font-semibold">Filter analytics to this product</button>
                  </div>
                ))}
                <p className="mt-3 text-xs text-gray-500">Order details stay on the Orders page. This panel does not change orders.</p>
              </div>
            </div>
          )}
        </>
      )}
      <BuyerDrillDown
        open={!!buyerKind}
        kind={buyerKind}
        query={query}
        range={data?.range}
        onClose={() => setBuyerKind('')}
      />
    </div>
  );
}
