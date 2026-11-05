'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import useAdminAccess from '@/hooks/useAdminAccess';
import { formatPrice } from '@/lib/utils';
import { todayIstYmd } from '@/lib/istTime';

const emptyCombined = {
  q: '',
  orderId: '',
  customer: '',
  phone: '',
  tracking: '',
  courier: '',
  sales: '',
  editor: '',
  source: '',
  status: '',
  paymentDate: '',
  dispatchDate: '',
};

export default function AdminReportsPage() {
  const { canRead } = useAdminAccess();
  const readable = canRead('reports') || canRead('orders') || canRead('operations');
  const [tab, setTab] = useState('payments');
  const [from, setFrom] = useState(todayIstYmd);
  const [to, setTo] = useState(todayIstYmd);
  const [kind, setKind] = useState('');
  const [verified, setVerified] = useState('');
  const [method, setMethod] = useState('');
  const [staff, setStaff] = useState('');
  const [courier, setCourier] = useState('');
  const [state, setState] = useState('');
  const [combined, setCombined] = useState(emptyCombined);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    if (!readable) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ type: tab, from, to });
      if (tab === 'payments') {
        if (kind) params.set('kind', kind);
        if (verified) params.set('verified', verified);
        if (method) params.set('method', method);
        if (staff) params.set('staff', staff);
      }
      if (tab === 'dispatch') {
        if (courier) params.set('courier', courier);
        if (state) params.set('state', state);
      }
      if (tab === 'orders') {
        Object.entries(combined).forEach(([k, v]) => {
          if (v) params.set(k, v);
        });
      }
      const res = await fetch(`/api/admin/reports?${params}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Report failed');
      setData(json);
    } catch (err) {
      toast.error(err.message || 'Unable to load report');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [readable, tab, from, to, kind, verified, method, staff, courier, state, combined]);

  useEffect(() => {
    load();
  }, [load]);

  if (!readable) {
    return <p className="p-6 text-sm text-gray-600">You do not have permission to view reports.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Payment & Dispatch Reports</h1>
          <p className="text-sm text-gray-500">
            Uses actual payment dates and parcel dispatch dates (IST). Historical dates are never invented.
          </p>
        </div>
        <Link href="/account/manage/operations" className="inline-flex min-h-[44px] items-center justify-center rounded-xl border px-4 py-2 text-sm font-semibold">
          Operations
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          ['payments', 'Payment reports'],
          ['dispatch', 'Dispatch reports'],
          ['orders', 'Combined order history'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`min-h-[40px] rounded-xl border px-4 py-2 text-sm font-semibold ${tab === id ? 'border-primary-500 bg-primary-50 text-primary-900' : 'bg-white'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border bg-white p-4 space-y-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs font-semibold">From (IST)
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" />
          </label>
          <label className="text-xs font-semibold">To (IST)
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" />
          </label>
          <button
            type="button"
            className="self-end min-h-[40px] rounded-xl border px-3 py-2 text-sm font-semibold"
            onClick={() => {
              const t = todayIstYmd();
              setFrom(t);
              setTo(t);
            }}
          >
            Today
          </button>
          <button type="button" onClick={load} disabled={loading} className="self-end min-h-[40px] rounded-xl bg-primary-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        {tab === 'payments' ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <select value={kind} onChange={(e) => setKind(e.target.value)} className="rounded-xl border px-3 py-2 text-sm">
              <option value="">All kinds</option>
              <option value="advance">Advance</option>
              <option value="balance">Balance</option>
              <option value="revision">Revision</option>
              <option value="other">Other</option>
            </select>
            <select value={verified} onChange={(e) => setVerified(e.target.value)} className="rounded-xl border px-3 py-2 text-sm">
              <option value="">Verified + unverified</option>
              <option value="yes">Verified only</option>
              <option value="no">Unverified only</option>
            </select>
            <input value={method} onChange={(e) => setMethod(e.target.value)} placeholder="Payment method" className="rounded-xl border px-3 py-2 text-sm" />
            <input value={staff} onChange={(e) => setStaff(e.target.value)} placeholder="Entered by (staff)" className="rounded-xl border px-3 py-2 text-sm" />
          </div>
        ) : null}

        {tab === 'dispatch' ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <input value={courier} onChange={(e) => setCourier(e.target.value)} placeholder="Courier company" className="rounded-xl border px-3 py-2 text-sm" />
            <input value={state} onChange={(e) => setState(e.target.value)} placeholder="Destination state" className="rounded-xl border px-3 py-2 text-sm" />
          </div>
        ) : null}

        {tab === 'orders' ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <input value={combined.q} onChange={(e) => setCombined((c) => ({ ...c, q: e.target.value }))} placeholder="Search all" className="rounded-xl border px-3 py-2 text-sm" />
            <input value={combined.orderId} onChange={(e) => setCombined((c) => ({ ...c, orderId: e.target.value }))} placeholder="Order ID" className="rounded-xl border px-3 py-2 text-sm" />
            <input value={combined.customer} onChange={(e) => setCombined((c) => ({ ...c, customer: e.target.value }))} placeholder="Customer name" className="rounded-xl border px-3 py-2 text-sm" />
            <input value={combined.phone} onChange={(e) => setCombined((c) => ({ ...c, phone: e.target.value }))} placeholder="Phone" className="rounded-xl border px-3 py-2 text-sm" />
            <input value={combined.tracking} onChange={(e) => setCombined((c) => ({ ...c, tracking: e.target.value }))} placeholder="Tracking ID" className="rounded-xl border px-3 py-2 text-sm" />
            <input value={combined.courier} onChange={(e) => setCombined((c) => ({ ...c, courier: e.target.value }))} placeholder="Courier" className="rounded-xl border px-3 py-2 text-sm" />
            <input value={combined.sales} onChange={(e) => setCombined((c) => ({ ...c, sales: e.target.value }))} placeholder="Sales staff" className="rounded-xl border px-3 py-2 text-sm" />
            <input value={combined.editor} onChange={(e) => setCombined((c) => ({ ...c, editor: e.target.value }))} placeholder="Editor / printing" className="rounded-xl border px-3 py-2 text-sm" />
            <select value={combined.source} onChange={(e) => setCombined((c) => ({ ...c, source: e.target.value }))} className="rounded-xl border px-3 py-2 text-sm">
              <option value="">All sources</option>
              <option value="website">Website</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="instagram">Instagram</option>
            </select>
            <input value={combined.status} onChange={(e) => setCombined((c) => ({ ...c, status: e.target.value }))} placeholder="Status / ops status" className="rounded-xl border px-3 py-2 text-sm" />
            <label className="text-xs font-semibold">Payment date
              <input type="date" value={combined.paymentDate} onChange={(e) => setCombined((c) => ({ ...c, paymentDate: e.target.value }))} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm font-normal" />
            </label>
            <label className="text-xs font-semibold">Dispatch date
              <input type="date" value={combined.dispatchDate} onChange={(e) => setCombined((c) => ({ ...c, dispatchDate: e.target.value }))} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm font-normal" />
            </label>
          </div>
        ) : null}
      </div>

      {loading && !data ? <p className="text-sm text-gray-500">Loading…</p> : null}

      {data?.type === 'payments' ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard label="Payments" value={data.summary.count} />
            <SummaryCard label="Amount (range)" value={formatPrice(data.summary.amount)} />
            <SummaryCard label="Verified" value={`${data.summary.verifiedCount} · ${formatPrice(data.summary.verifiedTotal)}`} />
            <SummaryCard label="Unverified" value={`${data.summary.unverifiedCount} · ${formatPrice(data.summary.unverifiedTotal)}`} />
          </div>
          {data.truncated ? (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Showing {data.summary.listedCount || (data.payments || []).length} of {data.matchedCount} payments in this range. Summary totals include the full matched set.
            </p>
          ) : null}
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
            <MiniTable title={data.breakdownVerifiedOnly !== false ? 'By day (verified)' : 'By day'} rows={(data.byDay || []).map((r) => [r.date, `${r.count}`, formatPrice(r.amount)])} headers={['Date', 'Count', 'Amount']} />
            <MiniTable title={data.breakdownVerifiedOnly !== false ? 'By kind (verified)' : 'By kind'} rows={(data.byKind || []).map((r) => [r.kind, `${r.count}`, formatPrice(r.amount)])} headers={['Kind', 'Count', 'Amount']} />
            <MiniTable title={data.breakdownVerifiedOnly !== false ? 'By method (verified)' : 'By method'} rows={(data.byMethod || []).map((r) => [r.method, `${r.count}`, formatPrice(r.amount)])} headers={['Method', 'Count', 'Amount']} />
            <MiniTable title={data.breakdownVerifiedOnly !== false ? 'By staff (verified)' : 'By staff'} rows={(data.byStaff || []).map((r) => [r.staff, `${r.count}`, formatPrice(r.amount)])} headers={['Staff', 'Count', 'Amount']} />
          </div>
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-gray-600">
                  <th className="p-3">Paid (IST)</th>
                  <th className="p-3">Order</th>
                  <th className="p-3">Kind</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Method</th>
                  <th className="p-3">Reference</th>
                  <th className="p-3">Proof</th>
                  <th className="p-3">Verified</th>
                  <th className="p-3">Entered by</th>
                </tr>
              </thead>
              <tbody>
                {(data.payments || []).map((p) => (
                  <tr key={`${p.orderId}-${p.paymentId}`} className="border-t">
                    <td className="p-3 text-xs whitespace-nowrap">{p.paidAtIst}</td>
                    <td className="p-3 font-semibold">
                      <Link href={`/account/manage/orders?orderId=${encodeURIComponent(p.orderNumber || '')}`}>{p.orderNumber}</Link>
                      <p className="text-[11px] font-normal text-gray-500">{p.customerName}</p>
                    </td>
                    <td className="p-3 capitalize">{p.kind}</td>
                    <td className="p-3 font-semibold">{formatPrice(p.amount)}</td>
                    <td className="p-3">{p.method || '—'}</td>
                    <td className="p-3 text-xs font-mono">{p.reference || '—'}</td>
                    <td className="p-3 text-xs">
                      {p.proof ? (
                        <a href={p.proof} target="_blank" rel="noreferrer" className="font-semibold text-primary-700 underline">View</a>
                      ) : '—'}
                    </td>
                    <td className="p-3">{p.verified ? 'Yes' : 'No'}</td>
                    <td className="p-3">{p.enteredBy || '—'}</td>
                  </tr>
                ))}
                {!data.payments?.length ? (
                  <tr><td colSpan={9} className="p-6 text-center text-gray-500">No payments with dates in this range.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {data?.type === 'dispatch' ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard label="Parcels" value={data.summary.parcels} />
            <SummaryCard label="Orders in parcels" value={data.summary.orders} />
            <SummaryCard label="Total weight (kg)" value={Number(data.summary.weightKg || 0).toFixed(2)} />
            <SummaryCard label="Courier cost" value={formatPrice(data.summary.courierCost)} />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <MiniTable
              title="Per day"
              headers={['Date', 'Parcels', 'Orders', 'Weight', 'Cost']}
              rows={(data.byDay || []).map((r) => [r.date, `${r.parcels}`, `${r.orders}`, Number(r.weightKg || 0).toFixed(2), formatPrice(r.courierCost)])}
            />
            <MiniTable title="By state" headers={['State', 'Parcels', 'Cost']} rows={(data.byState || []).map((r) => [r.state, `${r.parcels}`, formatPrice(r.courierCost)])} />
            <MiniTable title="By courier" headers={['Courier', 'Parcels', 'Cost']} rows={(data.byCourier || []).map((r) => [r.courier, `${r.parcels}`, formatPrice(r.courierCost)])} />
          </div>
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="w-full min-w-[960px] text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-gray-600">
                  <th className="p-3">Dispatched (IST)</th>
                  <th className="p-3">Parcel</th>
                  <th className="p-3">Orders</th>
                  <th className="p-3">Tracking</th>
                  <th className="p-3">Weight</th>
                  <th className="p-3">Courier</th>
                  <th className="p-3">State</th>
                  <th className="p-3">Cost</th>
                </tr>
              </thead>
              <tbody>
                {(data.parcels || []).map((p) => (
                  <tr key={`${p.batchId}-${p.parcelId}`} className="border-t">
                    <td className="p-3 text-xs whitespace-nowrap">{p.dispatchedAtIst}</td>
                    <td className="p-3 font-semibold">{p.parcelCode}<p className="text-[11px] font-normal text-gray-500">{p.batchCode}</p></td>
                    <td className="p-3 text-xs">{(p.orderNumbers || []).join(', ') || p.orderCount}</td>
                    <td className="p-3 font-mono text-xs">{p.trackingNumber || '—'}</td>
                    <td className="p-3">{p.weightKg != null ? p.weightKg : '—'}</td>
                    <td className="p-3">{p.courierCompany || '—'}</td>
                    <td className="p-3">{p.destinationState || '—'}</td>
                    <td className="p-3">{formatPrice(p.effectiveCourierCost)}</td>
                  </tr>
                ))}
                {!data.parcels?.length ? (
                  <tr><td colSpan={8} className="p-6 text-center text-gray-500">No parcels with dispatch dates in this range.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {data?.type === 'orders' ? (
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full min-w-[1000px] text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-600">
                <th className="p-3">Order</th>
                <th className="p-3">Customer</th>
                <th className="p-3">Source</th>
                <th className="p-3">Staff</th>
                <th className="p-3">Payments</th>
                <th className="p-3">Parcels</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {(data.orders || []).map((o) => (
                <tr key={o.orderId} className="border-t align-top">
                  <td className="p-3 font-semibold">
                    <Link href={`/account/manage/orders?orderId=${encodeURIComponent(o.orderNumber || '')}`}>{o.orderNumber}</Link>
                    <p className="text-[11px] font-normal text-gray-500">{formatPrice(o.total || 0)}</p>
                  </td>
                  <td className="p-3">{o.customerName}<p className="text-[11px] text-gray-500">{o.phone}</p></td>
                  <td className="p-3 capitalize">{o.orderSource || '—'}</td>
                  <td className="p-3 text-xs">Sales: {o.salesStaff || '—'}<br />Editor: {o.editor || '—'}</td>
                  <td className="p-3 text-xs space-y-1">
                    {(o.payments || []).map((p, i) => (
                      <p key={i}>{p.kind} {formatPrice(p.amount)} · {p.paidAtIst}{p.verified ? '' : ' · unverified'}</p>
                    ))}
                    {!o.payments?.length ? '—' : null}
                  </td>
                  <td className="p-3 text-xs space-y-1">
                    {(o.parcels || []).map((p, i) => (
                      <p key={i}>{p.parcelCode} · {p.trackingNumber || 'no AWB'} · {p.dispatchedAtIst || '—'}</p>
                    ))}
                    {!o.parcels?.length ? '—' : null}
                  </td>
                  <td className="p-3 text-xs">{o.opsStatus || o.status}<p className="text-gray-500">{o.balanceStatus}</p></td>
                </tr>
              ))}
              {!data.orders?.length ? (
                <tr><td colSpan={7} className="p-6 text-center text-gray-500">No matching orders.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <p className="text-xs font-semibold text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function MiniTable({ title, headers, rows }) {
  return (
    <div className="rounded-xl border bg-white overflow-hidden">
      <div className="border-b bg-gray-50 px-3 py-2 text-sm font-bold">{title}</div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-gray-500">
              {headers.map((h) => <th key={h} className="px-3 py-2">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t">
                {row.map((cell, j) => <td key={j} className="px-3 py-1.5">{cell}</td>)}
              </tr>
            ))}
            {!rows.length ? (
              <tr><td colSpan={headers.length} className="px-3 py-4 text-gray-400">No data</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
