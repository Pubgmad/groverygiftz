'use client';
import { useState } from 'react';
import toast from 'react-hot-toast';

export default function Newsletter({
  badge = 'Newsletter',
  title = 'Get Exclusive Deals & Gift Ideas',
  subtitle = 'Join our newsletter for new arrivals, special offers and gifting inspiration - delivered straight to your inbox.',
  placeholder = 'Your email address',
}) {
  const [email, setEmail] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) { toast.success('Subscribed successfully!'); setEmail(''); }
      else { const data = await res.json(); toast.error(data.error || 'Failed to subscribe'); }
    } catch { toast.error('Something went wrong'); }
  };

  return (
    <div
      className="py-14 relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #F47920 0%, #F27A1A 52%, #D96212 100%)' }}
    >
      <div className="absolute top-0 left-0 w-72 h-72 rounded-full bg-white/10 blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-64 h-64 rounded-full bg-black/10 blur-3xl translate-x-1/3 translate-y-1/3 pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[8rem] opacity-[0.05] pointer-events-none select-none">GIFT</div>

      <span className="absolute top-4 left-[8%] text-2xl opacity-25 animate-float pointer-events-none select-none">*</span>
      <span className="absolute bottom-4 right-[10%] text-3xl opacity-20 animate-float2 pointer-events-none select-none">*</span>
      <span className="absolute top-6 right-[20%] text-xl opacity-20 animate-float3 pointer-events-none select-none">+</span>

      <div className="max-w-2xl mx-auto text-center px-4 relative z-10">
        <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm text-white border border-white/30 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-[0.18em] mb-4">{badge}
        </div>
        <h3 className="text-2xl md:text-3xl font-display font-bold text-white mb-2 drop-shadow">
          {title}
        </h3>
        <p className="text-white/80 mb-8 text-sm md:text-base max-w-md mx-auto">
          {subtitle}
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder={placeholder}
            className="flex-1 px-5 py-3.5 rounded-xl focus:outline-none text-gray-800 text-sm shadow-lg focus:ring-2 focus:ring-accent-300"
            required
          />
          <button
            type="submit"
            className="text-white px-7 py-3.5 rounded-xl font-bold text-sm transition-all duration-200 shadow-lg hover:-translate-y-0.5 hover:shadow-xl"
            style={{ background: 'linear-gradient(135deg, #C9570F, #A9480C)' }}
          >
            Subscribe</button>
        </form>
        <p className="text-white/55 text-xs mt-4">No spam, unsubscribe anytime. We respect your privacy.</p>
      </div>
    </div>
  );
}
