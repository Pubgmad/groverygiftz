'use client';
import { useEffect, useState } from 'react';
import { FiPhone, FiMail, FiMapPin, FiClock, FiInstagram, FiShield, FiSend } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { trackMetaEvent } from '@/lib/metaPixel';

const DEFAULT_CONTACT = {
  phone: '+91 99945 49781',
  email: 'Groverygiftz@gmail.com',
  address: '126, 3rd St, V.C.K.N.Layout, Sivananda Colony, Tatabad, Coimbatore, Tamil Nadu 641012',
  timings: '11 am to 7 pm',
  socialLinks: { instagram: 'https://www.instagram.com/groverygiftz?igsh=dGNpbHlybWI0cjNy' },
  tradeName: 'GroveryGiftz',
  gstNumber: '33KVUPS5560J1ZL',
};

const phoneHref = (phone) => 'tel:' + String(phone || '').replace(/\D/g, '');

export default function ContactPage() {
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', message: '' });
  const [settings, setSettings] = useState(DEFAULT_CONTACT);
  const [loading, setLoading] = useState(false);
  const displayTradeName = String(settings.tradeName || '').trim().toLowerCase() === 'grovery giftz' ? 'GroveryGiftz' : (settings.tradeName || 'GroveryGiftz');

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => setSettings({ ...DEFAULT_CONTACT, ...data, socialLinks: { ...DEFAULT_CONTACT.socialLinks, ...(data.socialLinks || {}) } }))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        toast.success('Message sent. We will get back to you shortly.');
        trackMetaEvent('Contact', { contact_method: 'contact_form' });
        setFormData({ name: '', email: '', phone: '', message: '' });
      } else {
        toast.error('Failed to send message');
      }
    } catch {
      toast.error('Something went wrong');
    }
    setLoading(false);
  };

  return (
    <div className="bg-white">
      <section className="bg-gradient-to-b from-primary-50 via-white to-white px-4 py-12 md:py-16">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-[1.05fr_0.95fr] gap-8 items-stretch">
          <div className="flex flex-col justify-center">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-primary-600 mb-3">GroveryGiftz Support</p>
            <h1 className="text-3xl md:text-5xl font-display font-bold leading-tight text-gray-950">We are here to help you gift better.</h1>
            <p className="mt-4 text-gray-600 max-w-2xl">Questions about customization, delivery, payment, or an order? Contact our Coimbatore team during working hours.</p>
            <div className="mt-6 flex flex-wrap gap-3 text-sm">
              <span className="rounded-full bg-white px-4 py-2 font-semibold text-primary-700 border border-primary-100 shadow-sm">Customer care: {settings.timings}</span>
              <span className="rounded-full bg-white px-4 py-2 font-semibold text-green-700 border border-green-100 shadow-sm">Pan India delivery</span>
            </div>
          </div>

          <div className="rounded-3xl border bg-white p-5 sm:p-6 shadow-sm">
            <h2 className="text-xl font-bold mb-4">Business Details</h2>
            <div className="space-y-3 text-sm text-gray-700">
              <div className="rounded-2xl bg-gray-50 p-4"><p className="text-xs font-bold uppercase text-gray-400">Trade Name</p><p className="font-bold text-gray-900 mt-1">{displayTradeName}</p></div>
              <div className="rounded-2xl bg-gray-50 p-4"><p className="text-xs font-bold uppercase text-gray-400">GSTIN</p><p className="font-mono font-bold text-gray-900 mt-1 break-all">{settings.gstNumber || '33KVUPS5560J1ZL'}</p></div>
              <div className="rounded-2xl bg-gray-50 p-4"><p className="text-xs font-bold uppercase text-gray-400">Address</p><p className="font-medium text-gray-900 mt-1">{settings.address}</p></div>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-10 md:py-14">
        <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-8">
          <div className="space-y-4">
            <div className="rounded-2xl border bg-white p-5 shadow-sm flex gap-4">
              <FiPhone className="text-primary-600 mt-1 shrink-0" size={22} />
              <div>
                <h3 className="font-bold">Customer Care</h3>
                <a href={phoneHref(settings.phone)} className="text-gray-700 hover:text-primary-600 font-semibold">{settings.phone}</a>
                <p className="text-sm text-gray-500 mt-1">Please contact between {settings.timings} only.</p>
              </div>
            </div>
            <div className="rounded-2xl border bg-white p-5 shadow-sm flex gap-4">
              <FiMail className="text-primary-600 mt-1 shrink-0" size={22} />
              <div className="min-w-0">
                <h3 className="font-bold">Mail Us</h3>
                <a href={'mailto:' + settings.email} className="text-gray-700 hover:text-primary-600 font-semibold break-all">{settings.email}</a>
              </div>
            </div>
            <div className="rounded-2xl border bg-white p-5 shadow-sm flex gap-4">
              <FiClock className="text-primary-600 mt-1 shrink-0" size={22} />
              <div>
                <h3 className="font-bold">Working Hours</h3>
                <p className="text-gray-700 font-semibold">{settings.timings}</p>
              </div>
            </div>
            <div className="rounded-2xl border bg-white p-5 shadow-sm flex gap-4">
              <FiMapPin className="text-primary-600 mt-1 shrink-0" size={22} />
              <div>
                <h3 className="font-bold">Location</h3>
                <p className="text-gray-600">{settings.address}</p>
              </div>
            </div>
            {settings.socialLinks?.instagram && (
              <a href={settings.socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold text-gray-700 hover:border-primary-200 hover:text-primary-600">
                <FiInstagram size={18} /> Instagram
              </a>
            )}
          </div>

          <div className="rounded-3xl border bg-gradient-to-b from-primary-50/60 to-white p-5 sm:p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-600 text-white"><FiSend size={20} /></div>
              <div>
                <h2 className="text-2xl font-display font-bold">Send a Message</h2>
                <p className="text-sm text-gray-500">Tell us what you need customized.</p>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input required placeholder="Name" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100" />
              <input type="email" required placeholder="Email" value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100" />
              <input placeholder="Phone Number" value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))} className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100" />
              <textarea required placeholder="Add a message" rows={5} value={formData.message} onChange={e => setFormData(p => ({ ...p, message: e.target.value }))} className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100" />
              <button disabled={loading} className="btn-primary w-full py-3 flex items-center justify-center gap-2">{loading ? 'Sending...' : 'Send Message'} <FiShield size={16} /></button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}