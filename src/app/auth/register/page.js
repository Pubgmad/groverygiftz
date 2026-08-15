'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { trackMetaEvent } from '@/lib/metaPixel';
import PasswordInput from '@/components/common/PasswordInput';
import { PASSWORD_REQUIREMENTS, validateStrongPassword, strongPasswordMessage } from '@/lib/passwordPolicy';

export default function RegisterPage() {
  const [formData, setFormData] = useState({ name: '', email: '', password: '', phone: '' });
  const [loading, setLoading] = useState(false);
  const [inputReady, setInputReady] = useState(false);
  const router = useRouter();
  const [callbackUrl, setCallbackUrl] = useState('/account');
  const passwordCheck = validateStrongPassword(formData.password);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedCallback = params.get('callbackUrl') || '/account';
    const customerCallback = requestedCallback.startsWith('/account/manage') || requestedCallback.startsWith('/admin') || !requestedCallback.startsWith('/') ? '/account' : requestedCallback;
    setCallbackUrl(customerCallback);
    setFormData({ name: '', email: '', password: '', phone: '' });
    const timer = setTimeout(() => setInputReady(true), 300);
    return () => clearTimeout(timer);
  }, []);


  const handleSubmit = async (e) => {
    e.preventDefault();
    const normalizedPhone = String(formData.phone || '').replace(/\D/g, '');
    if (normalizedPhone.length < 10 || normalizedPhone.length > 15) {
      toast.error('Please enter a valid contact number');
      return;
    }
    const check = validateStrongPassword(formData.password);
    if (!check.valid) {
      toast.error(strongPasswordMessage());
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/customers/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (res.ok) {
        trackMetaEvent('CompleteRegistration', { status: true, registration_method: 'email' });
        const loginResult = await signIn('credentials', {
          email: formData.email,
          password: formData.password,
          loginType: 'customer',
          redirect: false,
        });
        if (loginResult?.error) {
          toast.success('Account created. Please sign in to continue.');
          router.push(`/auth/login?callbackUrl=${encodeURIComponent(callbackUrl || '/account')}`);
          return;
        }
        toast.success('Account created!');
        router.push(callbackUrl || '/account');
      } else {
        toast.error(data.error || 'Registration failed');
      }
    } catch {
      toast.error('Something went wrong');
    }
    setLoading(false);
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="mb-2 text-center font-display text-3xl font-bold">Create Account</h1>
      <p className="mb-8 text-center text-sm text-gray-500">Create your customer account to place orders and track gifts.</p>
      <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
        <input required placeholder="Full Name" name="customer_register_name" autoComplete="off" readOnly={!inputReady} onFocus={() => setInputReady(true)} value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
          className="w-full rounded-lg border px-4 py-3 focus:border-primary-500 focus:outline-none" />
        <input type="email" required placeholder="Email" name="customer_register_email" autoComplete="off" readOnly={!inputReady} onFocus={() => setInputReady(true)} value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
          className="w-full rounded-lg border px-4 py-3 focus:border-primary-500 focus:outline-none" />
        <input required inputMode="tel" placeholder="Contact Number *" name="customer_register_phone" autoComplete="off" readOnly={!inputReady} onFocus={() => setInputReady(true)} value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
          className="w-full rounded-lg border px-4 py-3 focus:border-primary-500 focus:outline-none" />
        <PasswordInput required placeholder="Password" name="customer_register_password" autoComplete="new-password" readOnly={!inputReady} onFocus={() => setInputReady(true)} minLength={8} value={formData.password} onChange={e => setFormData(p => ({ ...p, password: e.target.value }))} />
        <div className="rounded-xl bg-primary-50/70 p-3 text-xs">
          <p className="mb-2 font-semibold text-gray-800">Password must include:</p>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {PASSWORD_REQUIREMENTS.map((rule) => {
              const passed = rule.test(formData.password);
              return <span key={rule.key} className={passed ? 'text-green-700' : 'text-gray-500'}>{passed ? 'OK' : '-'} {rule.label}</span>;
            })}
          </div>
        </div>
        <button disabled={loading || !passwordCheck.valid} className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60">{loading ? 'Creating...' : 'Create Account'}</button>
      </form>
      <p className="mt-6 text-center text-sm text-gray-500">
        Already have an account? <Link href={`/auth/login?callbackUrl=${encodeURIComponent(callbackUrl || '/account')}`} className="text-primary-600 hover:underline">Sign In</Link>
      </p>
    </div>
  );
}
