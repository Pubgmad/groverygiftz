'use client';
import { useEffect, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [inputReady, setInputReady] = useState(false);
  const router = useRouter();
  const [callbackUrl, setCallbackUrl] = useState('/account');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setCallbackUrl(params.get('callbackUrl') || '/account');
    setEmail('');
    setPassword('');
    const timer = setTimeout(() => setInputReady(true), 300);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const res = await signIn('credentials', { email, password, loginType: 'customer', redirect: false });
    setLoading(false);
    if (res?.ok) {
      toast.success('Welcome back!');
      router.push(callbackUrl || '/account');
    } else {
      toast.error('Invalid email or password');
    }
  };

  return (
    <div className="max-w-md mx-auto py-16 px-4">
      <h1 className="text-3xl font-display font-bold text-center mb-2">Sign In</h1>
      <p className="text-center text-gray-500 mb-8">Sign in to place orders and view your purchases</p>
      <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
        <input type="email" required placeholder="Email" name="customer_login_email" autoComplete="off" readOnly={!inputReady} onFocus={() => setInputReady(true)} value={email} onChange={e => setEmail(e.target.value)}
          className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:border-primary-500" />
        <input type="password" required placeholder="Password" name="customer_login_password" autoComplete="new-password" readOnly={!inputReady} onFocus={() => setInputReady(true)} value={password} onChange={e => setPassword(e.target.value)}
          className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:border-primary-500" />
        <button disabled={loading} className="btn-primary w-full">{loading ? 'Signing in...' : 'Sign In'}</button>
      </form>
      <p className="text-center mt-6 text-sm text-gray-500">
        Don&apos;t have an account? <Link href="/auth/register" className="text-primary-600 hover:underline">Create Account</Link>
      </p>
    </div>
  );
}

