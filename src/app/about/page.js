import Link from 'next/link';
import { FiAward, FiGift, FiHeart, FiMapPin, FiShield, FiStar, FiTruck, FiUsers } from 'react-icons/fi';

const products = [
  'Customized Photo Frames', 'Acrylic LED Lamps', 'Wooden Engraving Gifts', 'Personalized Name Boards',
  'Couple & Family Gifts', 'Baby Memory Gifts', 'Birthday & Anniversary Gifts', 'Wedding & Housewarming Gifts',
  'Corporate Gifts', 'Return Gifts', 'Custom Engraving Products',
];

const reasons = [
  'Premium Quality Materials', 'Unique & Exclusive Personalized Designs', 'Made-to-Order Products',
  'Secure Online Ordering', 'Safe Packaging for Every Shipment', 'Pan India Delivery',
  'Dedicated Customer Support', 'Thousands of Happy Customers',
];

export default function AboutPage() {
  return (
    <div className="bg-white">
      <section className="relative overflow-hidden bg-primary-900 text-white">
        <div className="absolute inset-0 gift-paper-band opacity-15" />
        <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:py-16 md:grid-cols-[1.1fr_0.9fr] md:px-6 md:py-24">
          <div>
            <p className="section-eyebrow text-accent-300">About GroveryGiftz</p>
            <h1 className="text-3xl font-display font-extrabold leading-tight sm:text-4xl md:text-6xl">Creating Memories That Last Forever</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/82">
              Every gift tells a story. From birthdays and anniversaries to weddings, baby showers, housewarmings and graduations, GroveryGiftz creates personalized gifts that preserve emotions beautifully.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/shop" className="btn-accent">Explore Gifts</Link>
              <Link href="/contact" className="rounded-xl border border-white/30 px-6 py-3 font-bold text-white transition-colors hover:bg-white hover:text-primary-800">Contact Us</Link>
            </div>
          </div>
          <div className="grid content-center gap-4">
            <div className="rounded-3xl border border-white/15 bg-white/10 p-6 backdrop-blur-sm">
              <div className="grid grid-cols-1 gap-3 text-center sm:grid-cols-2">
                <div><p className="text-2xl font-extrabold text-accent-300 sm:text-4xl">2023</p><p className="text-sm text-white/75">Founded in Coimbatore</p></div>
                <div><p className="text-2xl font-extrabold text-accent-300 sm:text-4xl">20,000+</p><p className="text-sm text-white/75">Happy customers</p></div>
                <div><p className="text-2xl font-extrabold text-accent-300 sm:text-4xl">India</p><p className="text-sm text-white/75">Pan India delivery</p></div>
                <div><p className="text-2xl font-extrabold text-accent-300 sm:text-4xl">Custom</p><p className="text-sm text-white/75">Made-to-order gifts</p></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-14 md:py-20">
        <div className="rounded-3xl border border-primary-100 bg-primary-50/45 p-6 md:p-10">
          <div className="flex items-center gap-3 text-primary-700"><FiMapPin size={22} /><p className="font-bold">Founded in Coimbatore, Tamil Nadu</p></div>
          <p className="mt-4 leading-8 text-gray-700">
            GroveryGiftz was created with a simple dream: to help people express their love and emotions through beautifully crafted personalized gifts. What started as a passionate vision in Coimbatore has grown into a trusted online personalized gifting brand, proudly serving customers across India.
          </p>
          <p className="mt-4 leading-8 text-gray-700">
            We wanted to build more than an online gift store. We wanted to create a brand where every product carries meaning, emotion and unforgettable memories. Every order represents a unique story, and we feel privileged to be part of our customers' most cherished moments.
          </p>
        </div>
      </section>

      <section className="gift-section-soft px-4 py-14 md:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 max-w-2xl"><p className="section-eyebrow">What We Create</p><h2 className="text-3xl font-display font-extrabold text-gray-950 md:text-5xl">Personalized gifts for every special moment</h2></div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {products.map((item) => <div key={item} className="rounded-2xl border border-white bg-white p-4 font-semibold text-gray-800 product-lift"><FiGift className="mb-3 text-accent-500" />{item}</div>)}
          </div>
          <p className="mt-8 max-w-3xl leading-8 text-gray-700">Every product is carefully designed using premium materials, advanced manufacturing technology and strict quality checks to ensure it becomes a gift worth remembering.</p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 md:py-20">
        <div className="grid gap-8 md:grid-cols-[0.8fr_1.2fr] md:items-start">
          <div><p className="section-eyebrow">Why Choose GroveryGiftz?</p><h2 className="text-3xl font-display font-extrabold text-gray-950 md:text-5xl">Made with care, delivered with love</h2><p className="mt-5 leading-8 text-gray-600">We do not believe in mass-produced gifts. Every customer deserves something created exclusively for them.</p></div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {reasons.map((reason, idx) => {
              const icons = [FiAward, FiStar, FiHeart, FiShield, FiGift, FiTruck, FiUsers, FiStar];
              const Icon = icons[idx % icons.length];
              return <div key={reason} className="flex items-center gap-3 rounded-2xl border bg-white p-4 shadow-sm"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-700"><Icon size={18} /></span><span className="font-semibold text-gray-800">{reason}</span></div>;
            })}
          </div>
        </div>
      </section>

      <section className="bg-primary-900 px-4 py-14 text-white md:py-20">
        <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-3">
          <div className="rounded-3xl bg-white/10 p-6"><p className="section-eyebrow text-accent-300">Our Mission</p><p className="leading-8 text-white/82">To make personalized gifting simple, meaningful and accessible for everyone through creativity, craftsmanship, innovation and exceptional customer service.</p></div>
          <div className="rounded-3xl bg-white/10 p-6"><p className="section-eyebrow text-accent-300">Our Vision</p><p className="leading-8 text-white/82">To become India's most trusted personalized gifting brand, known for innovation, premium quality and outstanding customer experience.</p></div>
          <div className="rounded-3xl bg-white/10 p-6"><p className="section-eyebrow text-accent-300">Our Promise</p><p className="leading-8 text-white/82">Every personalized gift is thoughtfully designed, carefully crafted, quality-checked, securely packed and delivered across India with love and care.</p></div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-14 text-center md:py-20">
        <h2 className="text-3xl font-display font-extrabold text-gray-950 md:text-5xl">Unwrap Happiness</h2>
        <p className="mt-5 leading-8 text-gray-700">When you choose GroveryGiftz, you are not just purchasing a product. You are preserving a memory, celebrating a relationship and creating a gift that will be cherished for years to come.</p>
        <p className="mt-5 font-semibold text-gray-900">Thank you for making GroveryGiftz a part of your life's beautiful moments.</p>
      </section>
    </div>
  );
}
