'use client';
import { useEffect, useState } from 'react';

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/customers').then(r => r.json()).then(d => { setCustomers(d.customers || []); setLoading(false); });
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Customers</h1>
      <div className="bg-white rounded-xl border overflow-hidden">
        {loading ? <p className="p-6 text-center">Loading...</p> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm">
            <thead><tr className="bg-gray-50 text-left"><th className="p-4">Name</th><th className="p-4">Email</th><th className="p-4">Phone</th><th className="p-4">Joined</th></tr></thead>
            <tbody>
              {customers.map(c => (
                <tr key={c._id} className="border-t hover:bg-gray-50">
                  <td className="p-4 font-medium">{c.name}</td>
                  <td className="p-4">{c.email}</td>
                  <td className="p-4">{c.phone || '-'}</td>
                  <td className="p-4 text-gray-500">{new Date(c.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {customers.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-gray-500">No customers yet</td></tr>}
            </tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}
