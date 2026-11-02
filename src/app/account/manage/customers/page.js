'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FiRefreshCw } from 'react-icons/fi';
import { formatPrice } from '@/lib/utils';
import AdminSelect from '@/components/admin/AdminSelect';
import DownloadCsvButton from '@/components/admin/DownloadCsvButton';

const typeOptions = [
  { value: '', label: 'All customers' },
  { value: 'purchased', label: 'Purchased' },
  { value: 'not_purchased', label: 'Not yet purchased' },
];

const typeLabels = {
  purchased: 'Purchased',
  not_purchased: 'Not yet purchased',
};

const formatDate = (date) => date
  ? `${new Date(date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })} IST`
  : '—';

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [customerType, setCustomerType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [lastFrom, setLastFrom] = useState('');
  const [lastTo, setLastTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 10;
  const registerError = dateFrom && dateTo && dateFrom > dateTo ? 'Registration from date cannot be after to date' : '';
  const lastError = lastFrom && lastTo && lastFrom > lastTo ? 'Last purchase from date cannot be after to date' : '';
  const dateError = registerError || lastError;

  const filterQuery = () => {
    const query = new URLSearchParams();
    if (name.trim()) query.set('name', name.trim());
    if (email.trim()) query.set('email', email.trim());
    if (mobile.trim()) query.set('mobile', mobile.trim());
    if (customerType) query.set('customerType', customerType);
    if (dateFrom) query.set('dateFrom', dateFrom);
    if (dateTo) query.set('dateTo', dateTo);
    if (lastFrom) query.set('lastFrom', lastFrom);
    if (lastTo) query.set('lastTo', lastTo);
    return query;
  };

  const fetchCustomers = async () => {
    const query = filterQuery();
    query.set('page', String(currentPage));
    query.set('limit', String(pageSize));
    const res = await fetch(`/api/customers?${query.toString()}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setCustomers([]);
      setTotalCustomers(0);
      setTotalPages(1);
      setLoading(false);
      if (data.error) toast.error(data.error);
      return;
    }
    setCustomers(data.customers || []);
    setTotalCustomers(Number(data.total || 0));
    setTotalPages(Math.max(1, Number(data.pages || 1)));
    setLoading(false);
  };

  useEffect(() => {
    if (dateError) {
      setCustomers([]);
      setTotalCustomers(0);
      setTotalPages(1);
      setLoading(false);
      return;
    }
    fetchCustomers();
  }, [currentPage, name, email, mobile, customerType, dateFrom, dateTo, lastFrom, lastTo, dateError]);

  useEffect(() => { setCurrentPage(1); }, [name, email, mobile, customerType, dateFrom, dateTo, lastFrom, lastTo]);
  useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages); }, [currentPage, totalPages]);

  const reset = () => {
    setName('');
    setEmail('');
    setMobile('');
    setCustomerType('');
    setDateFrom('');
    setDateTo('');
    setLastFrom('');
    setLastTo('');
    setCurrentPage(1);
  };

  return (
    <div className="min-w-0">
      <div className="mb-6 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="mt-1 text-sm leading-6 text-gray-500">Dates use Indian Standard Time (IST). Purchased means this registered account has at least one paid, non-cancelled order. This list is not unique-buyer analytics.</p>
        </div>
        <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row">
          <button type="button" onClick={reset} className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold sm:w-auto">
            <FiRefreshCw /> Reset filters
          </button>
          <DownloadCsvButton
            href={`/api/admin/customers/export?${filterQuery().toString()}`}
            fallbackName="customers.csv"
            disabled={!!dateError}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white">
        <div className="grid min-w-0 gap-3 border-b bg-gray-50 p-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-semibold text-gray-500">Customer Name</label>
            <input value={name} onChange={(e) => { setName(e.target.value); setCurrentPage(1); }} placeholder="Search name" className="min-h-[44px] w-full min-w-0 rounded-lg border px-3 py-2 text-sm" />
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-semibold text-gray-500">Email Address</label>
            <input value={email} onChange={(e) => { setEmail(e.target.value); setCurrentPage(1); }} placeholder="Search email" className="min-h-[44px] w-full min-w-0 rounded-lg border px-3 py-2 text-sm" />
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-semibold text-gray-500">Mobile Number</label>
            <input value={mobile} onChange={(e) => { setMobile(e.target.value); setCurrentPage(1); }} placeholder="Search mobile" className="min-h-[44px] w-full min-w-0 rounded-lg border px-3 py-2 text-sm" />
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-semibold text-gray-500">Customer Type</label>
            <AdminSelect value={customerType} onChange={(next) => { setCustomerType(next); setCurrentPage(1); }} options={typeOptions} />
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-semibold text-gray-500">Registration From Date</label>
            <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }} className="min-h-[44px] w-full min-w-0 rounded-lg border px-3 py-2 text-sm" />
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-semibold text-gray-500">Registration To Date</label>
            <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }} className="min-h-[44px] w-full min-w-0 rounded-lg border px-3 py-2 text-sm" />
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-semibold text-gray-500">Last Purchase From</label>
            <input type="date" value={lastFrom} onChange={(e) => { setLastFrom(e.target.value); setCurrentPage(1); }} className="min-h-[44px] w-full min-w-0 rounded-lg border px-3 py-2 text-sm" />
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-semibold text-gray-500">Last Purchase To</label>
            <input type="date" value={lastTo} onChange={(e) => { setLastTo(e.target.value); setCurrentPage(1); }} className="min-h-[44px] w-full min-w-0 rounded-lg border px-3 py-2 text-sm" />
          </div>
          {dateError ? <p className="text-sm text-red-600 sm:col-span-2 xl:col-span-4">{dateError}</p> : null}
        </div>

        {loading ? <p className="p-6 text-center text-sm text-gray-500">Loading...</p> : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-gray-600">
                    <th className="p-4">Name</th>
                    <th className="p-4">Email</th>
                    <th className="p-4">Mobile</th>
                    <th className="p-4">Joined</th>
                    <th className="p-4">Type</th>
                    <th className="p-4">Orders</th>
                    <th className="p-4">Spent</th>
                    <th className="p-4">Last purchase</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer) => (
                    <tr key={customer._id} className="border-t hover:bg-gray-50">
                      <td className="p-4 font-medium">{customer.name || '—'}</td>
                      <td className="max-w-[220px] break-all p-4">{customer.email || '—'}</td>
                      <td className="p-4 whitespace-nowrap">{customer.phone || '—'}</td>
                      <td className="p-4 whitespace-nowrap text-gray-500">{formatDate(customer.createdAt)}</td>
                      <td className="p-4">{typeLabels[customer.customerType] || 'Not yet purchased'}</td>
                      <td className="p-4">{customer.qualifyingOrders || 0}</td>
                      <td className="p-4">{formatPrice(customer.totalSpent || 0)}</td>
                      <td className="p-4 whitespace-nowrap text-gray-500">{formatDate(customer.lastPurchaseAt)}</td>
                    </tr>
                  ))}
                  {customers.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-gray-500">No customers match your filters</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {totalCustomers > pageSize && (
              <div className="flex flex-col gap-3 border-t bg-gray-50 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                <p className="text-gray-500">Showing {totalCustomers === 0 ? 0 : (currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, totalCustomers)} of {totalCustomers} customers</p>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1} className="rounded-lg border px-3 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-50">Previous</button>
                  <span className="rounded-lg bg-white px-3 py-2 font-semibold text-gray-700">Page {currentPage} of {totalPages}</span>
                  <button type="button" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages} className="rounded-lg border px-3 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-50">Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
