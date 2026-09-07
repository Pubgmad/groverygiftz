'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import PasswordInput from '@/components/common/PasswordInput';
import { PASSWORD_REQUIREMENTS, validateStrongPassword, strongPasswordMessage } from '@/lib/passwordPolicy';

export default function ResetPasswordPage() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const passwordCheck = validateStrongPassword(password);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const check = validateStrongPassword(password);
    if (!check.valid) {
      toast.error(strongPasswordMessage());
      return;
    }

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
          <PasswordInput required minLength={8} placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <div className="rounded-xl bg-primary-50/70 p-3 text-xs">
            <p className="mb-2 font-semibold text-gray-800">Password must include:</p>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {PASSWORD_REQUIREMENTS.map((rule) => {
                const passed = rule.test(password);
                return <span key={rule.key} className={passed ? 'text-green-700' : 'text-gray-500'}>{passed ? 'OK' : '-'} {rule.label}</span>;
              })}
            </div>
          </div>
          <button disabled={loading || !passwordCheck.valid} className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60">{loading ? 'Updating...' : 'Update Password'}</button>
        </form>
      )}
      <p className="mt-6 text-center text-sm text-gray-500"><Link href="/auth/login" className="text-primary-600 hover:underline">Back to sign in</Link></p>
    </div>
  );
}
