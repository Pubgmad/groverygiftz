'use client';
import { useEffect, useState } from 'react';
import { getSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [inputReady, setInputReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setEmail('');
    setPassword('');
    const timer = setTimeout(() => setInputReady(true), 300);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const res = await signIn('credentials', { email, password, loginType: 'admin', redirect: false });
    const session = res?.ok ? await getSession() : null;
    setLoading(false);

    if (res?.ok && session?.user?.type === 'admin') {
      toast.success('Admin signed in');
      router.push('/account/manage');
      return;
    }

    toast.error('Only the store admin can sign in here');
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16 bg-gradient-to-b from-primary-50/70 to-white">
      <div className="max-w-md w-full bg-white border rounded-2xl shadow-sm p-6 md:p-8">
        <h1 className="text-3xl font-display font-bold text-center mb-2">Admin Login</h1>
        <p className="text-center text-gray-500 mb-8">Store owner access only</p>
        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
          <input type="email" required placeholder="Admin email" name="store_admin_email" autoComplete="off" readOnly={!inputReady} onFocus={() => setInputReady(true)} value={email} onChange={e => setEmail(e.target.value)}
            className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:border-primary-500" />
          <input type="password" required placeholder="Password" name="store_admin_password" autoComplete="new-password" readOnly={!inputReady} onFocus={() => setInputReady(true)} value={password} onChange={e => setPassword(e.target.value)}
            className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:border-primary-500" />
          <button disabled={loading} className="btn-primary w-full">{loading ? 'Signing in...' : 'Sign In'}</button>
        </form>
      </div>
    </div>
  );
}
