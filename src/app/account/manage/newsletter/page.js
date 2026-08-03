'use client';
import { useEffect, useState } from 'react';

export default function AdminNewsletterPage() {
  const [subscribers, setSubscribers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/newsletter').then(r => r.json()).then(d => { setSubscribers(d.subscribers || []); setLoading(false); });
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Newsletter Subscribers ({subscribers.length})</h1>
      <div className="bg-white rounded-xl border overflow-hidden">
        {loading ? <p className="p-6 text-center">Loading...</p> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm">
            <thead><tr className="bg-gray-50 text-left"><th className="p-4">#</th><th className="p-4">Email</th><th className="p-4">Subscribed</th></tr></thead>
            <tbody>
              {subscribers.map((s, idx) => (
                <tr key={s._id} className="border-t hover:bg-gray-50">
                  <td className="p-4 text-gray-500">{idx + 1}</td>
                  <td className="p-4 font-medium">{s.email}</td>
                  <td className="p-4 text-gray-500">{new Date(s.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {subscribers.length === 0 && <tr><td colSpan={3} className="p-6 text-center text-gray-500">No subscribers yet</td></tr>}
            </tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}
