'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import PasswordInput from '@/components/common/PasswordInput';

export default function ResetPasswordPage() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to reset password');
      toast.success('Password updated. Please sign in.');
      router.push('/auth/login');
    } catch (error) {
      toast.error(error.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="mb-2 text-center font-display text-3xl font-bold">Reset Password</h1>
      <p className="mb-8 text-center text-sm text-gray-500">Choose a new password for your GroveryGiftz account.</p>
      {!token ? (
        <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">Reset token is missing. Please request a new reset link.</div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <PasswordInput required minLength={6} placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button disabled={loading} className="btn-primary w-full">{loading ? 'Updating...' : 'Update Password'}</button>
        </form>
      )}
      <p className="mt-6 text-center text-sm text-gray-500"><Link href="/auth/login" className="text-primary-600 hover:underline">Back to sign in</Link></p>
    </div>
  );
}
