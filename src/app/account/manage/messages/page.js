'use client';
import { useEffect, useState } from 'react';
import { FiCheck } from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function AdminMessagesPage() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    fetch('/api/contact').then(r => r.json()).then(d => { setMessages(d.messages || []); setLoading(false); });
  }, []);

  const markRead = async (id) => {
    // We would need a PATCH/PUT endpoint for this - for now just visually toggle
    setMessages(prev => prev.map(m => m._id === id ? { ...m, isRead: true } : m));
    toast.success('Marked as read');
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Contact Messages</h1>
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border overflow-hidden">
          {loading ? <p className="p-6 text-center">Loading...</p> : (
            <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm">
              <thead><tr className="bg-gray-50 text-left"><th className="p-4">From</th><th className="p-4">Email</th><th className="p-4">Date</th><th className="p-4">Status</th></tr></thead>
              <tbody>
                {messages.map(m => (
                  <tr key={m._id} className={`border-t cursor-pointer hover:bg-gray-50 ${!m.isRead ? 'font-semibold' : ''} ${selected?._id === m._id ? 'bg-primary-50' : ''}`}
                    onClick={() => setSelected(m)}>
                    <td className="p-4">{m.name}</td>
                    <td className="p-4">{m.email}</td>
                    <td className="p-4 text-gray-500">{new Date(m.createdAt).toLocaleDateString()}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs ${m.isRead ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-800'}`}>
                        {m.isRead ? 'Read' : 'New'}
                      </span>
                    </td>
                  </tr>
                ))}
                {messages.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-gray-500">No messages</td></tr>}
              </tbody>
            </table></div>
          )}
        </div>

        <div className="bg-white rounded-xl border p-4 sm:p-6">
          {selected ? (
            <div>
              <h2 className="font-bold text-lg mb-4 break-words">Message from {selected.name}</h2>
              <div className="space-y-3 text-sm">
                <div className="break-all"><span className="text-gray-500">Email:</span> {selected.email}</div>
                {selected.phone && <div><span className="text-gray-500">Phone:</span> {selected.phone}</div>}
                <div><span className="text-gray-500">Date:</span> {new Date(selected.createdAt).toLocaleString()}</div>
                <div className="border-t pt-3"><p className="text-gray-700 whitespace-pre-wrap">{selected.message}</p></div>
                {!selected.isRead && (
                  <button onClick={() => markRead(selected._id)} className="flex items-center gap-2 text-primary-600 text-sm mt-4">
                    <FiCheck /> Mark as Read
                  </button>
                )}
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">Select a message to view</p>
          )}
        </div>
      </div>
    </div>
  );
}
