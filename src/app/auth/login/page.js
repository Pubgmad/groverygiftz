'use client';
import { useEffect, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import PasswordInput from '@/components/common/PasswordInput';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [inputReady, setInputReady] = useState(false);
  const router = useRouter();
  const [callbackUrl, setCallbackUrl] = useState('/account');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedCallback = params.get('callbackUrl') || '/account';
    const customerCallback = requestedCallback.startsWith('/account/manage') || requestedCallback.startsWith('/admin') || !requestedCallback.startsWith('/') ? '/account' : requestedCallback;
    setCallbackUrl(customerCallback);
    setEmail('');
    setPassword('');
    if (params.get('googleError') === 'missing-email') toast.error('Google did not return an email address. Please use email/password login.');
    const timer = setTimeout(() => setInputReady(true), 300);
    return () => clearTimeout(timer);
  }, []);

  const handleGoogleSignIn = () => {
    document.cookie = 'google_auth_intent=signin; path=/; max-age=600; SameSite=Lax';
    signIn('google', { callbackUrl }, { prompt: 'select_account' });
  };

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
        <PasswordInput required placeholder="Password" name="customer_login_password" autoComplete="new-password" readOnly={!inputReady} onFocus={() => setInputReady(true)} value={password} onChange={e => setPassword(e.target.value)} />
        <div className="text-right"><Link href="/auth/forgot-password" className="text-sm font-semibold text-primary-600 hover:underline">Forgot Password?</Link></div>
        <button disabled={loading} className="btn-primary w-full">{loading ? 'Signing in...' : 'Sign In'}</button>
      </form>
      <div className="my-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-widest text-gray-400"><span className="h-px flex-1 bg-gray-200" />or<span className="h-px flex-1 bg-gray-200" /></div>
      <button type="button" onClick={handleGoogleSignIn} className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-700 transition hover:border-primary-200 hover:bg-primary-50">Continue with Google</button>
      <p className="text-center mt-6 text-sm text-gray-500">
        Don&apos;t have an account? <Link href="/auth/register" className="text-primary-600 hover:underline">Create Account</Link>
      </p>
    </div>
  );
}
