'use client';
import { useEffect, useMemo, useState } from 'react';
import { formatPrice } from '@/lib/utils';
import { buildDeliveryEstimateText } from '@/lib/deliveryDate';
import toast from 'react-hot-toast';

const statusOptions = [
  { value: 'ordered', label: 'Ordered' },
  { value: 'on_process', label: 'On Process' },
  { value: 'dispatched', label: 'Order Dispatched' },
];
const statusFilterOptions = [
  { value: '', label: 'All statuses' },
  { value: 'ordered', label: 'Ordered' },
  { value: 'on_process', label: 'On Process' },
  { value: 'dispatched', label: 'Order Dispatched' },
  { value: 'cancelled', label: 'Cancelled' },
];
const statusLabels = {
  ordered: 'Ordered',
  on_process: 'On Process',
  dispatched: 'Order Dispatched',
  pending: 'Ordered',
  processing: 'On Process',
  shipped: 'Order Dispatched',
  delivered: 'Order Dispatched',
  cancelled: 'Cancelled',
};

const statusColors = {
  ordered: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  on_process: 'bg-sky-50 text-sky-700 border border-sky-200',
  dispatched: 'bg-amber-50 text-amber-700 border border-amber-200',
  pending: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  processing: 'bg-sky-50 text-sky-700 border border-sky-200',
  shipped: 'bg-amber-50 text-amber-700 border border-amber-200',
  delivered: 'bg-amber-50 text-amber-700 border border-amber-200',
  cancelled: 'bg-red-50 text-red-700 border border-red-200',
};

const paymentStatusColors = {
  pending: 'bg-amber-50 text-amber-700 border border-amber-200',
  paid: 'bg-green-50 text-green-700 border border-green-200',
  failed: 'bg-red-50 text-red-700 border border-red-200',
  refunded: 'bg-gray-50 text-gray-700 border border-gray-200',
};

const normalizeStatus = (status) => {
  if (status === 'processing') return 'on_process';
  if (status === 'shipped' || status === 'delivered') return 'dispatched';
  if (status === 'pending') return 'ordered';
  return status || 'ordered';
};

const formatDate = (date) => date ? new Date(date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) + ' IST' : '-';
const isUploadedFile = (value) => value && typeof value === 'object' && value.url;
const isOutOfTamilNadu = (order) => String(order.shippingAddress?.state || '').trim().toLowerCase() !== 'tamil nadu';
const addressLine = (address = {}) => [address.line1, address.line2, address.city, address.state, address.pincode].filter(Boolean).join(', ');
const getEstimateBaseText = (estimate = '') => String(estimate || '').split(' - expected by ')[0].trim();
const getAdminDeliveryEstimate = (order, holidays = []) => {
  const baseEstimate = getEstimateBaseText(order?.deliveryEstimate);
  if (!baseEstimate) return order?.deliveryEstimate || '-';
  return buildDeliveryEstimateText(baseEstimate, {
    startDate: order.paidAt || order.createdAt,
    fallbackDays: isOutOfTamilNadu(order) ? 15 : 8,
    holidays,
  });
};
const formatFileSize = (bytes) => {
  const size = Number(bytes || 0);
  if (!size) return '';
  if (size >= 1024 * 1024 * 1024) return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  if (size >= 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${size} B`;
};
const fileSizeLabel = (file) => {
  const size = formatFileSize(file?.size);
  return size ? ` (${size})` : '';
};
const originalDownloadHref = (file) => {
  if (!file?.url) return '';
  if (file.originalUrl) return file.originalUrl;
  if (!String(file.url).startsWith('/customizations/')) return file.url;
  const filename = String(file.url).split('/').pop();
  const name = file.name || filename || 'original-upload';
  return `/api/customization-upload/original/${encodeURIComponent(filename)}?name=${encodeURIComponent(name)}`;
};
const getFileExtension = (file = {}) => {
  const fromName = String(file.name || '').split('.').pop();
  if (fromName && fromName !== file.name) return fromName.toLowerCase();
  const fromUrl = String(file.url || '').split('?')[0].split('.').pop();
  if (fromUrl && fromUrl !== file.url) return fromUrl.toLowerCase();
  if (file.type?.includes('/')) return file.type.split('/').pop().toLowerCase();
  return 'file';
};
const buildDownloadName = (prefix, label, index, file) => {
  const safeLabel = String(label || 'file').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'file';
  return `${prefix}-${safeLabel}-${index + 1}.${getFileExtension(file)}`;
};

function DownloadButton({ href, filename, children, tone = 'primary' }) {
  if (!href) return null;
  const styles = tone === 'accent'
    ? 'border-accent-200 bg-accent-50 text-accent-700 hover:bg-accent-100'
    : 'border-primary-200 bg-primary-50 text-primary-700 hover:bg-primary-100';
  return (
    <a href={href} download={filename} target="_blank" rel="noopener noreferrer" className={`inline-flex w-full items-center justify-center rounded-lg border px-3 py-2 text-center text-xs font-bold transition sm:w-auto ${styles}`}>
      {children}
    </a>
  );
}

function CustomValue({ value }) {
  if (Array.isArray(value)) {
    return (
      <span className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {value.map((file, idx) => isUploadedFile(file) ? (
          <DownloadButton key={file.url || idx} href={originalDownloadHref(file)} filename={buildDownloadName('original-upload', file.name || 'custom-file', idx, file)}>Download original {idx + 1}{file.name ? ` (${file.name})` : ''}</DownloadButton>
        ) : <span key={idx}>{String(file || '-')}</span>)}
      </span>
    );
  }
  if (isUploadedFile(value)) {
    return <DownloadButton href={originalDownloadHref(value)} filename={buildDownloadName('original-upload', value.name || 'custom-file', 0, value)}>Download original{value.name ? ` (${value.name})` : ''}</DownloadButton>;
  }
  if (value && typeof value === 'object') {
    return (
      <span className="mt-1 flex flex-col gap-2">
        {Object.entries(value).map(([childLabel, childValue]) => (
          <span key={childLabel} className="rounded-md border bg-gray-50 p-2">
            <span className="mb-1 block font-semibold text-gray-700">{childValue?.label || childLabel}</span>
            <CustomValue value={childValue} />
          </span>
        ))}
      </span>
    );
  }
  return <span>{String(value || '-')}</span>;
}
function CollageUploadDetails({ groups }) {
  const visibleGroups = Array.isArray(groups) ? groups.filter((group) => group?.label && Array.isArray(group.images) && group.images.length > 0) : [];
  if (visibleGroups.length === 0) return null;
  return (
    <div className="rounded-md bg-white border p-2 space-y-3">
      <p className="text-xs font-semibold text-gray-700">Collage uploads</p>
      {visibleGroups.map((group) => (
        <div key={group.label} className="rounded-lg border bg-gray-50 p-2">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-bold text-gray-900">{group.label}</p>
            <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-bold text-primary-700">{group.images.length} image{group.images.length === 1 ? '' : 's'} | allowed {group.minImages || 0}-{group.maxImages || group.images.length}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {group.images.map((image, index) => (
              <div key={image.url || index} className="space-y-1">
                <a href={image.url} target="_blank" rel="noopener noreferrer" className="relative block aspect-square overflow-hidden rounded-lg border bg-white">
                  <img src={image.url} alt={`${group.label} ${index + 1}`} className="h-full w-full object-cover" />
                  <span className="absolute left-1 top-1 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">{index + 1}</span>
                </a>
                <DownloadButton href={originalDownloadHref(image)} filename={buildDownloadName('collage-original', group.label, index, image)}>Original {index + 1}{fileSizeLabel(image)}</DownloadButton>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
function PreviewDetails({ preview }) {
  const previews = Array.isArray(preview?.previews) ? preview.previews : [];
  if (previews.length > 0) {
    return (
      <div className="rounded-md bg-primary-50 border border-primary-100 p-2 space-y-2 text-xs text-gray-700">
        <p className="font-semibold text-primary-800">Saved preview / crop instructions</p>
        <p><span className="font-medium">Preview:</span> {preview.previewTitle || '-'}</p>
        {previews.map((entry, index) => {
          const finalPreviewUrl = entry.finalPreviewImage?.url || entry.finalPreviewDataUrl;
          return (
            <div key={`${entry.areaLabel || 'area'}-${index}`} className="rounded-md border border-primary-100 bg-white p-2 space-y-3">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <p className="font-semibold text-gray-900">{entry.areaLabel || `Photo ${index + 1}`}</p>
                <p className="text-[11px] font-semibold text-gray-500">Frame: {entry.width || '-'} x {entry.height || '-'} {entry.unit || 'inch'}</p>
              </div>
              {finalPreviewUrl && (
                <a href={finalPreviewUrl} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg border bg-white">
                  <img src={finalPreviewUrl} alt={`${entry.areaLabel || 'Preview'} final`} className="max-h-72 w-full object-contain" />
                </a>
              )}
              <div className="grid gap-2 sm:grid-cols-2">
                <DownloadButton href={originalDownloadHref(entry.uploadedFile)} filename={buildDownloadName('original-upload', entry.areaLabel, index, entry.uploadedFile)}>Download original image{fileSizeLabel(entry.uploadedFile)}</DownloadButton>
                <DownloadButton href={finalPreviewUrl} filename={buildDownloadName('customized-preview', entry.areaLabel, index, entry.finalPreviewImage || { url: finalPreviewUrl, type: 'image/jpeg' })} tone="accent">Download final preview</DownloadButton>
              </div>
              {entry.instructions && <p><span className="font-medium">Instructions:</span> {entry.instructions}</p>}
              {entry.adjustments && (<p><span className="font-medium">Saved alignment:</span> zoom {entry.adjustments.zoom}, x {entry.adjustments.x}, y {entry.adjustments.y}, direction {entry.adjustments.orientation || 'auto'}</p>)}
            </div>
          );
        })}
      </div>
    );
  }
  if (preview?.uploadedFile?.url) {
    return (
      <div className="rounded-md bg-primary-50 border border-primary-100 p-2 space-y-1 text-xs text-gray-700">
        <p className="font-semibold text-primary-800">Saved preview / crop instructions</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <DownloadButton href={originalDownloadHref(preview.uploadedFile)} filename={buildDownloadName('original-upload', preview.sourceField || 'preview', 0, preview.uploadedFile)}>Download original image{fileSizeLabel(preview.uploadedFile)}</DownloadButton>
          <DownloadButton href={preview.finalPreviewImage?.url || preview.finalPreviewDataUrl || preview.uploadedFile.url} filename={buildDownloadName('customized-preview', preview.sourceField || 'preview', 0, preview.finalPreviewImage || preview.uploadedFile)} tone="accent">Download final preview</DownloadButton>
        </div>
        <p><span className="font-medium">Source field:</span> {preview.sourceField || '-'}</p>
        <p><span className="font-medium">Frame:</span> {preview.previewTitle || '-'}</p>
        <p><span className="font-medium">Ratio:</span> {preview.aspectRatio || '-'}</p>
        {preview.adjustments && (<p><span className="font-medium">Crop:</span> zoom {preview.adjustments.zoom}, x {preview.adjustments.x}, y {preview.adjustments.y}, filter {preview.adjustments.filter}</p>)}
      </div>
    );
  }
  return null;
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [trackingDraft, setTrackingDraft] = useState('');
  const [orderFilter, setOrderFilter] = useState('');
  const [mobileFilter, setMobileFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [deliveryHolidays, setDeliveryHolidays] = useState([]);
  const pageSize = 10;

  const fetchOrders = async () => {
    const query = new URLSearchParams();
    if (dateFrom) query.set('dateFrom', dateFrom);
    if (dateTo) query.set('dateTo', dateTo);
    const res = await fetch(`/api/orders${query.toString() ? `?${query.toString()}` : ''}`);
    const data = await res.json();
    const nextOrders = data.orders || [];
    setOrders(nextOrders);
    setLoading(false);
    if (selected?._id) setSelected(nextOrders.find((order) => order._id === selected._id) || null);
  };

  useEffect(() => { fetchOrders(); }, [dateFrom, dateTo]);

  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => setDeliveryHolidays(Array.isArray(data.deliveryHolidays) ? data.deliveryHolidays : []))
      .catch(() => setDeliveryHolidays([]));
  }, []);

  useEffect(() => {
    setTrackingDraft(selected?.trackingNumber || '');
  }, [selected?._id, selected?.trackingNumber]);

  const filteredOrders = useMemo(() => {
    const orderTerm = orderFilter.trim().toLowerCase();
    const mobileTerm = mobileFilter.trim().replace(/\D/g, '');
    return orders.filter((order) => {
      const matchesOrder = !orderTerm || String(order.orderNumber || '').toLowerCase().includes(orderTerm);
      const phone = String(order.shippingAddress?.phone || '').replace(/\D/g, '');
      const whatsapp = String(order.shippingAddress?.whatsappNumber || '').replace(/\D/g, '');
      const matchesMobile = !mobileTerm || phone.includes(mobileTerm) || whatsapp.includes(mobileTerm);
      const matchesStatus = !statusFilter || normalizeStatus(order.status) === statusFilter;
      return matchesOrder && matchesMobile && matchesStatus;
    });
  }, [orders, orderFilter, mobileFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => { setCurrentPage(1); }, [orderFilter, mobileFilter, statusFilter, dateFrom, dateTo]);
  useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages); }, [currentPage, totalPages]);
  useEffect(() => {
    if (selected?._id && !filteredOrders.some((order) => order._id === selected._id)) setSelected(null);
  }, [filteredOrders, selected?._id]);
  const updateStatus = async (id, status) => {
    const res = await fetch(`/api/orders/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
    });
    if (res.ok) {
      toast.success('Status updated');
      const data = await res.json();
      setSelected(data);
      await fetchOrders();
    } else toast.error('Failed to update');
  };

  const updateTracking = async (id, trackingNumber) => {
    const res = await fetch(`/api/orders/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trackingNumber: trackingNumber.trim() }),
    });
    if (!res.ok) {
      toast.error('Failed to save tracking ID');
      return;
    }
    toast.success('ST Couriers tracking ID saved. Customer can see it in My Account.');
    const data = await res.json();
    setSelected(data);
    await fetchOrders();
  };

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Orders</h1>
          <p className="text-sm text-gray-500">Dates are shown and filtered in Indian Standard Time (IST). Update production status and ST Couriers tracking from the selected order.</p>
        </div>
      </div>

      <div className={`grid gap-6 ${selected ? 'xl:grid-cols-3' : ''}`}>
        <div className={`${selected ? 'xl:col-span-2' : ''} bg-white rounded-xl border overflow-hidden`}>
          <div className="grid gap-3 border-b bg-gray-50 p-4 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Order ID</label>
              <input value={orderFilter} onChange={(e) => setOrderFilter(e.target.value)} placeholder="Search GG0001" className="w-full rounded-lg border px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Mobile Number</label>
              <input value={mobileFilter} onChange={(e) => setMobileFilter(e.target.value)} placeholder="Search mobile" className="w-full rounded-lg border px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Status</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm">
                {statusFilterOptions.map((status) => <option key={status.value || 'all'} value={status.value}>{status.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">From Date</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">To Date</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm" />
            </div>
          </div>

          {loading ? <p className="p-6 text-center">Loading...</p> : (<>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[1050px]">
                <thead>
                  <tr className="bg-gray-50 text-left text-gray-600">
                    <th className="p-4">SNO</th>
                    <th className="p-4">Order ID</th>
                    <th className="p-4">Order Date</th>
                    <th className="p-4">Name</th>
                    <th className="p-4">Mobile</th>
                    <th className="p-4">City</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Payment</th>
                    <th className="p-4 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedOrders.map((order, idx) => {
                    const outOfTn = isOutOfTamilNadu(order);
                    const normalized = normalizeStatus(order.status);
                    return (
                      <tr key={order._id} className={`border-t cursor-pointer hover:bg-gray-50 ${selected?._id === order._id ? 'bg-primary-50' : ''}`} onClick={() => setSelected((current) => current?._id === order._id ? null : order)}>
                        <td className="p-4 font-semibold text-gray-500">{(currentPage - 1) * pageSize + idx + 1}</td>
                        <td className="p-4 font-bold text-primary-700">{order.orderNumber}</td>
                        <td className="p-4 text-gray-600 whitespace-nowrap">{formatDate(order.paidAt || order.createdAt)}</td>
                        <td className="p-4"><p className="font-medium text-gray-900">{order.shippingAddress?.fullName || '-'}</p><p className="text-xs text-gray-500">{order.shippingAddress?.email || order.guestEmail || '-'}</p></td>
                        <td className="p-4 font-medium whitespace-nowrap"><p>{order.shippingAddress?.phone || '-'}</p>{order.shippingAddress?.whatsappNumber && <p className="text-xs text-green-700">WA: {order.shippingAddress.whatsappNumber}</p>}</td>
                        <td className="p-4 max-w-[160px]"><p className="font-medium text-gray-700 break-words">{order.shippingAddress?.city || '-'}</p>{outOfTn && <span className="mt-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Outside TN</span>}</td>
                        <td className="p-4"><span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusColors[normalized] || statusColors.ordered}`}>{statusLabels[normalized] || normalized}</span></td>
                        <td className="p-4"><span className={`px-2 py-1 rounded-full text-xs font-semibold ${paymentStatusColors[order.paymentStatus] || paymentStatusColors.pending}`}>{order.paymentMethod || 'Cashfree'} {order.paymentStatus}</span></td>
                        <td className="p-4 text-right font-medium">{formatPrice(order.total)}</td>
                      </tr>
                    );
                  })}
                  {filteredOrders.length === 0 && <tr><td colSpan={9} className="p-6 text-center text-gray-500">No orders match your filters</td></tr>}
                </tbody>
              </table>
            </div>
          {filteredOrders.length > pageSize && (
            <div className="flex flex-col gap-3 border-t bg-gray-50 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="text-gray-500">Showing {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, filteredOrders.length)} of {filteredOrders.length} orders</p>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1} className="rounded-lg border px-3 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-50">Previous</button>
                <span className="rounded-lg bg-white px-3 py-2 font-semibold text-gray-700">Page {currentPage} of {totalPages}</span>
                <button type="button" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages} className="rounded-lg border px-3 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-50">Next</button>
              </div>
            </div>
          )}
          </>)}
        </div>

        {selected && (
        <div className="bg-white rounded-xl border p-5 md:p-6">
            <div>
              <h2 className="font-bold text-lg mb-4">Order {selected.orderNumber}</h2>
              <div className="space-y-3 text-sm">
                {selected.shippingAddress && (
                  <div className="pt-2">
                    <h3 className="font-semibold mt-4 mb-2">Shipping</h3>
                    <div className="rounded-lg border bg-gray-50 p-3 space-y-1">
                      <p className="font-semibold">{selected.shippingAddress.fullName}</p>
                      <p>Mobile: {selected.shippingAddress.phone}</p>{selected.shippingAddress.whatsappNumber && <p>WhatsApp: {selected.shippingAddress.whatsappNumber}</p>}
                      <p>{selected.shippingAddress.line1}</p>
                      {selected.shippingAddress.line2 && <p>{selected.shippingAddress.line2}</p>}
                      <p>{selected.shippingAddress.city}, {selected.shippingAddress.state}{selected.shippingAddress.pincode ? ` - ${selected.shippingAddress.pincode}` : ''}</p>
                      <p>{selected.shippingAddress.email || selected.guestEmail}</p>
                    </div>
                  </div>
                )}

                {isOutOfTamilNadu(selected) && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800">
                    Outside Tamil Nadu order. Delivery charge applies and timeline is usually 10 to 15 days.
                  </div>
                )}
                <div><span className="text-gray-500">Order date:</span> {formatDate(selected.paidAt || selected.createdAt)}</div>
                <div><span className="text-gray-500">Estimated delivery:</span> <span className="font-medium">{getAdminDeliveryEstimate(selected, deliveryHolidays)}</span></div>
                {selected.notes && <div className="rounded-lg border bg-yellow-50 p-3"><span className="text-gray-500">Customer note:</span> <p className="font-medium text-gray-900 whitespace-pre-wrap">{selected.notes}</p></div>}
                <div>
                  <span className="text-gray-500">Status:</span>
                  <select value={normalizeStatus(selected.status)} onChange={e => updateStatus(selected._id, e.target.value)} className="ml-2 border rounded px-2 py-1 text-sm">
                    {statusOptions.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-gray-500">Payment:</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${paymentStatusColors[selected.paymentStatus] || paymentStatusColors.pending}`}>{selected.paymentStatus}</span>
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{selected.paymentMethod || 'Cashfree'}</span>
                </div>
                <div className="border rounded-lg p-3 bg-gray-50 space-y-2">
                  <p className="text-xs text-gray-600 leading-relaxed"><strong>ST Couriers tracking ID:</strong> after booking the parcel with ST Couriers, paste the tracking ID here. Customers can copy it and open the ST website.</p>
                  <label className="text-xs font-medium text-gray-700">Tracking ID</label>
                  <input value={trackingDraft} onChange={(e) => setTrackingDraft(e.target.value)} placeholder="Enter ST Couriers tracking ID" className="border rounded-lg px-3 py-2 text-sm font-mono w-full" />
                  <button type="button" onClick={() => updateTracking(selected._id, trackingDraft)} className="text-sm px-4 py-2 rounded-lg bg-primary-600 text-white font-semibold hover:bg-primary-700">Save tracking ID</button>
                </div>

                <h3 className="font-semibold mt-4">Items</h3>
                <div className="space-y-3">
                  {selected.items?.map((item, idx) => (
                    <div key={idx} className="rounded-lg border bg-gray-50 p-3 space-y-2">
                      <div className="flex justify-between gap-3"><div><p className="font-semibold text-gray-900">{item.title} x{item.quantity}</p>{item.variant && <p className="text-xs text-gray-500">Selected: {item.variant}</p>}</div><span className="font-semibold whitespace-nowrap">{formatPrice(item.price * item.quantity)}</span></div>
                      {item.customFields && Object.keys(item.customFields).length > 0 && (
                        <div className="rounded-md bg-white border p-2 space-y-1"><p className="text-xs font-semibold text-gray-600">Customization</p>{Object.entries(item.customFields).map(([label, value]) => (<div key={label} className="text-xs text-gray-700"><span className="font-medium">{label}: </span><CustomValue value={value} /></div>))}</div>
                      )}
                      {item.collageUploads && <CollageUploadDetails groups={item.collageUploads} />}
                      {item.customizationPreview && <PreviewDetails preview={item.customizationPreview} />}
                    </div>
                  ))}
                </div>
                <div className="border-t pt-2 space-y-1"><div className="flex justify-between"><span>Subtotal</span><span>{formatPrice(selected.subtotal || 0)}</span></div><div className="flex justify-between"><span>Delivery</span><span>{selected.shippingCost === 0 ? 'FREE' : formatPrice(selected.shippingCost || 0)}</span></div><div className="flex justify-between font-bold"><span>Total</span><span>{formatPrice(selected.total)}</span></div></div>



              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
