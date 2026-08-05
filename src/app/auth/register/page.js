'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { trackMetaEvent } from '@/lib/metaPixel';
import PasswordInput from '@/components/common/PasswordInput';

export default function RegisterPage() {
  const [formData, setFormData] = useState({ name: '', email: '', password: '', phone: '' });
  const [loading, setLoading] = useState(false);
  const [inputReady, setInputReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setFormData({ name: '', email: '', password: '', phone: '' });
    const timer = setTimeout(() => setInputReady(true), 300);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/customers/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Account created! Please log in.');
        trackMetaEvent('CompleteRegistration', { status: true, registration_method: 'email' });
        router.push('/auth/login');
      } else {
        toast.error(data.error || 'Registration failed');
      }
    } catch {
      toast.error('Something went wrong');
    }
    setLoading(false);
  };

  return (
    <div className="max-w-md mx-auto py-16 px-4">
      <h1 className="text-3xl font-display font-bold text-center mb-8">Create Account</h1>
      <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
        <input required placeholder="Full Name" name="customer_register_name" autoComplete="off" readOnly={!inputReady} onFocus={() => setInputReady(true)} value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
          className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:border-primary-500" />
        <input type="email" required placeholder="Email" name="customer_register_email" autoComplete="off" readOnly={!inputReady} onFocus={() => setInputReady(true)} value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
          className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:border-primary-500" />
        <input placeholder="Phone (optional)" name="customer_register_phone" autoComplete="off" readOnly={!inputReady} onFocus={() => setInputReady(true)} value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
          className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:border-primary-500" />
        <PasswordInput required placeholder="Password" name="customer_register_password" autoComplete="new-password" readOnly={!inputReady} onFocus={() => setInputReady(true)} minLength={6} value={formData.password} onChange={e => setFormData(p => ({ ...p, password: e.target.value }))} />
        <button disabled={loading} className="btn-primary w-full">{loading ? 'Creating...' : 'Create Account'}</button>
      </form>
      <p className="text-center mt-6 text-sm text-gray-500">
        Already have an account? <Link href="/auth/login" className="text-primary-600 hover:underline">Sign In</Link>
      </p>
    </div>
  );
}
