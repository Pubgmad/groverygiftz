'use client';
import { useState, useRef } from 'react';
import { FiSearch, FiCalendar, FiGift, FiChevronRight, FiZap, FiStar } from 'react-icons/fi';
import { formatPrice } from '@/lib/utils';

export default function GiftFinder({ intro, occasions, types, quickPicks }) {
  const [query, setQuery] = useState('');
  const [occasion, setOccasion] = useState('');
  const [giftType, setGiftType] = useState('');
  const [recommendations, setRecommendations] = useState([]);
  const [recommending, setRecommending] = useState(false);
  const formRef = useRef(null);

  const occOptions = (occasions || []).filter((o) => o.value && o.label);
  const typeOptions = (types || []).filter((t) => t.value && t.label);
  const picks = (quickPicks || []).filter((p) => p.label);
  const scrollToForm = () => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const applyQuickPick = (pick) => {
    if (pick.occasion) setOccasion(pick.occasion);
    if (pick.giftType) setGiftType(pick.giftType);
    scrollToForm();
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim() || occasion || giftType) {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (occasion) params.set('occasion', occasion);
      if (giftType) params.set('giftType', giftType);
      window.location.href = `/search?${params.toString()}`;
    }
  };

  const getRecommendations = async () => {
    setRecommending(true);
    try {
      const res = await fetch('/api/gift-advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, occasion, giftType }),
      });
      const data = await res.json();
      setRecommendations(data.recommendations || []);
    } catch {
      setRecommendations([]);
    } finally {
      setRecommending(false);
    }
  };

  return (
    <section id="smart-gift-finder" className="relative overflow-hidden bg-primary-800 py-16 md:py-24">
      <div className="absolute inset-0 pointer-events-none opacity-20 gift-paper-band" />
      <div className="max-w-4xl mx-auto px-4 relative z-10">
        <div className="mb-8 md:mb-10 text-center">
          <div className="inline-flex flex-col sm:flex-row sm:items-center sm:justify-center gap-2 sm:gap-4 mb-5">
            <span className="text-white font-display font-extrabold text-2xl md:text-3xl tracking-tight drop-shadow-sm">{intro.stillConfused}</span>
            <span className="hidden sm:inline text-white/30 text-2xl font-light">|</span>
            <span className="text-accent-200 font-semibold text-sm md:text-base uppercase tracking-[0.25em]">{intro.tryLine}</span>
          </div>
          <p className="text-white/78 text-sm md:text-base max-w-lg mx-auto mb-6 leading-relaxed">{intro.description}</p>
          <div className="flex flex-wrap justify-center gap-2 mb-2">
            {picks.map((pick) => (
              <button key={pick.label} type="button" onClick={() => applyQuickPick(pick)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold bg-white/12 text-white border border-white/25 hover:bg-white/20 hover:border-accent-300/60 transition-all duration-200 backdrop-blur-sm">
                <FiZap size={14} className="text-accent-300 shrink-0" />{pick.label}
              </button>
            ))}
            <button type="button" onClick={scrollToForm} className="inline-flex items-center gap-1 px-4 py-2 rounded-full text-sm font-bold bg-accent-500 text-white shadow-orange hover:bg-accent-600 transition-colors">Start search <FiChevronRight size={16} /></button>
          </div>
        </div>

        <div ref={formRef} className="relative">
          <form id="gift-finder-form" onSubmit={handleSearch} className="relative bg-white rounded-2xl border border-white shadow-[0_24px_60px_-12px_rgba(15,39,120,0.45)] p-4 sm:p-6 md:p-8">
            <div className="flex items-center gap-2 mb-5 pb-4 border-b border-gray-100">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center text-white shadow-brand"><FiGift size={18} /></div>
              <div className="text-left"><p className="text-xs font-bold uppercase tracking-widest text-primary-500">Find the perfect gift</p><p className="text-sm text-gray-500">Optional filters + product recommendations</p></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div><label className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 mb-1.5"><FiCalendar size={13} className="text-accent-500" /> Occasion</label><select value={occasion} onChange={(e) => setOccasion(e.target.value)} className="input-field"><option value="">Select Occasion</option>{occOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
              <div><label className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 mb-1.5"><FiGift size={13} className="text-accent-500" /> Gift type</label><select value={giftType} onChange={(e) => setGiftType(e.target.value)} className="input-field"><option value="">Select Gift Type</option>{typeOptions.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}</select></div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative"><FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} /><input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. moon lamp, bottle of love, hamper" className="input-field pl-11 py-4 text-base" /></div>
              <button type="submit" className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 whitespace-normal rounded-xl bg-accent-500 px-5 py-4 text-center text-sm font-bold text-white shadow-orange transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent-600 sm:w-auto sm:whitespace-nowrap sm:px-8 sm:text-base">Find my gift <FiChevronRight size={18} /></button>
              <button type="button" onClick={getRecommendations} disabled={recommending} className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 whitespace-normal rounded-xl border border-primary-200 bg-primary-50 px-5 py-4 text-center text-sm font-bold text-primary-700 transition-all duration-200 hover:bg-primary-100 disabled:opacity-60 sm:w-auto sm:whitespace-nowrap sm:px-6 sm:text-base"><FiStar size={18} /> {recommending ? 'Finding...' : 'Recommend'}</button>
            </div>
          </form>

          {recommendations.length > 0 && (
            <div className="mt-5 rounded-2xl bg-white p-5 shadow-[0_18px_50px_-18px_rgba(15,39,120,0.45)]">
              <div className="mb-4"><p className="font-bold text-gray-900">Recommended gifts for you</p><p className="text-xs text-gray-500">Based only on products available in your store</p></div>
              <div className="grid gap-3 sm:grid-cols-2">
                {recommendations.map((item) => (
                  <a key={item.slug} href={`/products/${item.slug}`} className="flex gap-3 rounded-xl border bg-gray-50 p-3 transition-colors hover:border-primary-200 hover:bg-primary-50/60">
                    {item.image ? <img src={item.image} alt={item.title} className="h-16 w-16 flex-shrink-0 rounded-lg object-cover" /> : <span className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700"><FiGift size={22} /></span>}
                    <div className="min-w-0"><p className="line-clamp-2 text-sm font-bold text-gray-900">{item.title}</p><p className="mt-1 text-xs font-semibold text-primary-700">{formatPrice(item.price)}</p><p className="mt-1 line-clamp-2 text-xs text-gray-500">{item.reason}</p></div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

