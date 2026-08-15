'use client';
import { useEffect, useState } from 'react';
import { FaWhatsapp } from 'react-icons/fa';
import { trackMetaEvent } from '@/lib/metaPixel';

export default function WhatsAppFloat() {
  const [whatsapp, setWhatsapp] = useState('919994549781');

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((settings) => {
        if (settings?.whatsapp) setWhatsapp(String(settings.whatsapp).replace(/\D/g, ''));
      })
      .catch(() => {});
  }, []);

  return (
    <div className="group fixed bottom-6 right-6 z-50 flex items-center gap-3">
      <span className="pointer-events-none max-w-[190px] translate-x-2 rounded-xl bg-gray-900 px-3 py-2 text-xs font-medium text-white opacity-0 shadow-lg transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 group-focus-within:translate-x-0 group-focus-within:opacity-100">
        Need help, chat with us
      </span>
      <a
        href={`https://wa.me/${whatsapp}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500 text-white shadow-lg transition-all duration-200 hover:scale-110 hover:bg-green-600 focus-visible:scale-110 focus-visible:bg-green-600"
        aria-label="Contact us on WhatsApp"
        onClick={() => trackMetaEvent('Contact', { contact_method: 'whatsapp' })}
      >
        <FaWhatsapp size={28} />
      </a>
    </div>
  );
}
