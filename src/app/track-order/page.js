import Link from 'next/link';
import { FiExternalLink, FiPackage, FiCopy, FiUser } from 'react-icons/fi';

export default function TrackOrderPage() {
  return (
    <div className="min-h-[70vh] bg-gradient-to-b from-primary-50/70 via-white to-white px-4 py-12">
      <div className="max-w-3xl mx-auto">
        <div className="rounded-3xl border bg-white p-6 sm:p-8 shadow-sm text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-primary-50 text-primary-600">
            <FiPackage size={30} />
          </div>
          <h1 className="text-3xl font-display font-bold mb-3">Courier Tracking</h1>
          <p className="text-gray-600 max-w-xl mx-auto">
            ST Couriers can be tracked only with the courier tracking ID. After your order is dispatched, GroveryGiftz will add that tracking ID in your account.
          </p>

          <div className="mt-7 grid sm:grid-cols-3 gap-3 text-left">
            <div className="rounded-2xl border bg-gray-50 p-4">
              <FiUser className="text-primary-600 mb-3" size={22} />
              <p className="font-bold text-gray-900">Open My Account</p>
              <p className="text-sm text-gray-500 mt-1">Check your order status and find the ST tracking ID after dispatch.</p>
            </div>
            <div className="rounded-2xl border bg-gray-50 p-4">
              <FiCopy className="text-primary-600 mb-3" size={22} />
              <p className="font-bold text-gray-900">Copy Tracking ID</p>
              <p className="text-sm text-gray-500 mt-1">Copy the ST Couriers tracking number shown in your order timeline.</p>
            </div>
            <div className="rounded-2xl border bg-gray-50 p-4">
              <FiExternalLink className="text-primary-600 mb-3" size={22} />
              <p className="font-bold text-gray-900">Track on ST</p>
              <p className="text-sm text-gray-500 mt-1">Paste the tracking ID on the ST Couriers tracking website.</p>
            </div>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/account" className="btn-primary w-full px-6 py-3 text-center sm:w-auto sm:px-7">View My Orders</Link>
            <a href="https://stcourier.com/track/shipment" target="_blank" rel="noopener noreferrer" className="btn-outline inline-flex w-full items-center justify-center gap-2 px-6 py-3 text-center sm:w-auto sm:px-7">
              Go to ST Website <FiExternalLink size={16} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}