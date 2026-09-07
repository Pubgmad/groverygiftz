'use client';
import { useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetLink, setResetLink] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResetLink('');
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to start reset');
      toast.success(data.message || 'Reset link generated');
      if (data.resetLink) setResetLink(data.resetLink);
    } catch (error) {
      toast.error(error.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="mb-2 text-center font-display text-3xl font-bold">Forgot Password</h1>
      <p className="mb-8 text-center text-sm text-gray-500">Enter your registered email to receive a secure reset link.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="email" required placeholder="Registered email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border px-4 py-3 focus:border-primary-500 focus:outline-none" />
        <button disabled={loading} className="btn-primary w-full">{loading ? 'Sending...' : 'Send Reset Link'}</button>
      </form>
      {resetLink && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 break-all">Testing reset link: <Link href={resetLink} className="font-bold underline">{resetLink}</Link></div>}
      <p className="mt-6 text-center text-sm text-gray-500"><Link href="/auth/login" className="text-primary-600 hover:underline">Back to sign in</Link></p>
    </div>
  );
}
