'use client';
import { useEffect, useMemo, useState } from 'react';
import { formatPrice } from '@/lib/utils';
import { getOrderDeliveryEstimate, isOrderOutOfTamilNadu } from '@/lib/orderDeliveryEstimate';
import { formatLongIstDate } from '@/lib/businessCalendar';
import toast from 'react-hot-toast';
import useAdminAccess from '@/hooks/useAdminAccess';
import ReadOnlyBanner from '@/components/admin/ReadOnlyBanner';
import AdminSelect from '@/components/admin/AdminSelect';
import DownloadCsvButton from '@/components/admin/DownloadCsvButton';
import ShippingLabelModal from '@/components/admin/ShippingLabelModal';
import CreateWhatsAppOrderModal from '@/components/admin/CreateWhatsAppOrderModal';
import OrderOpsPanel from '@/components/admin/OrderOpsPanel';
import OrderDesignSheetsPanel from '@/components/admin/OrderDesignSheetsPanel';
import { MAX_SHIPPING_LABEL_ORDERS } from '@/lib/shippingLabelLayout';
import { ORDER_SOURCE_LABELS, OPS_STATUS_LABELS, isDelayedOrder } from '@/lib/opsConstants';
import { todayIstYmd, tomorrowIstYmd } from '@/lib/istTime';
import { FiPlus, FiRefreshCw } from 'react-icons/fi';
import { customerImageDisplaySrc } from '@/lib/configuredImages';

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
const addressLine = (address = {}) => [address.line1, address.line2, address.city, address.state, address.pincode].filter(Boolean).join(', ');

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
    <a href={href} download={filename} target="_blank" rel="noopener noreferrer" className={`inline-flex min-w-0 max-w-full w-full items-center justify-center rounded-lg border px-3 py-2 text-center text-xs font-bold whitespace-normal break-words transition sm:w-auto ${styles}`}>
      {children}
    </a>
  );
}

function CustomerPhotoThumb({ file, index, label }) {
  const displayUrl = customerImageDisplaySrc(file);
  const downloadHref = originalDownloadHref(file);
  if (!displayUrl && !downloadHref) return null;
  return (
    <span className="inline-flex min-w-0 max-w-[9rem] flex-col gap-1">
      {displayUrl ? (
        <a href={downloadHref || displayUrl} target="_blank" rel="noopener noreferrer" className="relative block aspect-square overflow-hidden rounded-lg border bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={displayUrl} alt={file?.name || `${label || 'Photo'} ${index + 1}`} className="h-full w-full object-cover" />
        </a>
      ) : null}
      <DownloadButton href={downloadHref} filename={buildDownloadName('original-upload', file?.name || label || 'custom-file', index, file)}>
        Download original {index + 1}{file?.name ? ` (${file.name})` : ''}
      </DownloadButton>
    </span>
  );
}

function CustomValue({ value }) {
  if (Array.isArray(value)) {
    const uploaded = value.filter((file) => isUploadedFile(file));
    if (uploaded.length > 0) {
      return (
        <span className="flex min-w-0 max-w-full flex-wrap gap-2 break-words">
          {uploaded.map((file, idx) => (
            <CustomerPhotoThumb key={file.url || file.displayUrl || idx} file={file} index={idx} />
          ))}
        </span>
      );
    }
    return (
      <span className="flex min-w-0 max-w-full flex-col gap-2 break-words sm:flex-row sm:flex-wrap">
        {value.map((file, idx) => <span key={idx} className="break-words">{String(file || '-')}</span>)}
      </span>
    );
  }
  if (isUploadedFile(value)) {
    return <CustomerPhotoThumb file={value} index={0} />;
  }
  if (value && typeof value === 'object') {
    return (
      <span className="mt-1 flex min-w-0 max-w-full flex-col gap-2 break-words">
        {Object.entries(value).map(([childLabel, childValue]) => (
          <span key={childLabel} className="min-w-0 max-w-full rounded-md border bg-gray-50 p-2 break-words">
            <span className="mb-1 block font-semibold text-gray-700 break-words">{childValue?.label || childLabel}</span>
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
    <div className="min-w-0 max-w-full overflow-hidden rounded-md bg-white border p-2 space-y-3">
      <p className="text-xs font-semibold text-gray-700">Collage uploads</p>
      {visibleGroups.map((group) => (
        <div key={group.label} className="min-w-0 max-w-full overflow-hidden rounded-lg border bg-gray-50 p-2">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="min-w-0 text-xs font-bold text-gray-900 break-words">{group.label}</p>
            <span className="max-w-full rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-bold text-primary-700 whitespace-normal break-words">{group.images.length} image{group.images.length === 1 ? '' : 's'} | allowed {group.minImages || 0}-{group.maxImages || group.images.length}</span>
          </div>
          <div className="grid min-w-0 max-w-full grid-cols-3 gap-2 sm:grid-cols-5">
            {group.images.map((image, index) => (
              <div key={image.url || index} className="min-w-0 space-y-1">
                <a href={originalDownloadHref(image) || customerImageDisplaySrc(image) || image.displayUrl || image.url} target="_blank" rel="noopener noreferrer" className="relative block aspect-square overflow-hidden rounded-lg border bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={customerImageDisplaySrc(image) || image.displayUrl || image.url} alt={`${group.label} ${index + 1}`} className="h-full w-full object-cover" />
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
      <div className="min-w-0 max-w-full overflow-hidden rounded-md bg-primary-50 border border-primary-100 p-2 space-y-2 text-xs text-gray-700 break-words">
        <p className="font-semibold text-primary-800">Saved preview / crop instructions</p>
        <p><span className="font-medium">Preview:</span> {preview.previewTitle || '-'}</p>
        {previews.map((entry, index) => {
          const finalPreviewUrl = customerImageDisplaySrc(entry.finalPreviewImage)
            || entry.finalPreviewImage?.displayUrl
            || (entry.finalPreviewImage?.url && !String(entry.finalPreviewImage.url).startsWith('blob:') ? entry.finalPreviewImage.url : '')
            || (entry.finalPreviewDataUrl && !String(entry.finalPreviewDataUrl).startsWith('blob:') && !String(entry.finalPreviewDataUrl).startsWith('data:') ? entry.finalPreviewDataUrl : '');
          return (
            <div key={`${entry.areaLabel || 'area'}-${index}`} className="min-w-0 max-w-full overflow-hidden rounded-md border border-primary-100 bg-white p-2 space-y-3">
              <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <p className="min-w-0 font-semibold text-gray-900 break-words">{entry.areaLabel || `Photo ${index + 1}`}</p>
                <p className="text-[11px] font-semibold text-gray-500 break-words">Frame: {entry.width || '-'} x {entry.height || '-'} {entry.unit || 'inch'}</p>
              </div>
              {finalPreviewUrl && (
                <a href={finalPreviewUrl} target="_blank" rel="noopener noreferrer" className="block max-w-full overflow-hidden rounded-lg border bg-white">
                  <img src={finalPreviewUrl} alt={`${entry.areaLabel || 'Preview'} final`} className="max-h-72 w-full max-w-full object-contain" />
                </a>
              )}
              <div className="grid min-w-0 max-w-full gap-2 sm:grid-cols-2">
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
      <div className="min-w-0 max-w-full overflow-hidden rounded-md bg-primary-50 border border-primary-100 p-2 space-y-1 text-xs text-gray-700 break-words">
        <p className="font-semibold text-primary-800">Saved preview / crop instructions</p>
        <div className="grid min-w-0 max-w-full gap-2 sm:grid-cols-2">
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
  const { canRead, canWrite } = useAdminAccess();
  const readable = canRead('orders');
  const writable = canWrite('orders');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [trackingDraft, setTrackingDraft] = useState('');
  const [orderFilter, setOrderFilter] = useState('');
  const [nameFilter, setNameFilter] = useState('');
  const [mobileFilter, setMobileFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [orderDate, setOrderDate] = useState('');
  const [expectedFrom, setExpectedFrom] = useState('');
  const [expectedTo, setExpectedTo] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState('');
  const [filtersReady, setFiltersReady] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [deliveryHolidays, setDeliveryHolidays] = useState([]);
  const [checkedIds, setCheckedIds] = useState(() => new Set());
  const [labelModalOpen, setLabelModalOpen] = useState(false);
  const [createWaOpen, setCreateWaOpen] = useState(false);
  const [sourceFilter, setSourceFilter] = useState('');
  const [selectingMatching, setSelectingMatching] = useState(false);
  const pageSize = 10;
  const dateError = dateFrom && dateTo && dateFrom > dateTo ? 'Paid From cannot be after Paid To' : '';
  const expectedError = expectedFrom && expectedTo && expectedFrom > expectedTo
    ? 'Expected dispatch From cannot be after To'
    : '';
  const checkedCount = checkedIds.size;
  const selectedLabelIds = useMemo(() => [...checkedIds], [checkedIds]);
  const pageIds = useMemo(() => orders.map((order) => String(order._id)), [orders]);
  const pageSelectedCount = pageIds.filter((id) => checkedIds.has(id)).length;
  const allPageSelected = pageIds.length > 0 && pageSelectedCount === pageIds.length;
  const somePageSelected = pageSelectedCount > 0 && !allPageSelected;
  const hiddenSelectedCount = useMemo(() => {
    if (!checkedCount) return 0;
    const visible = new Set(pageIds);
    let hidden = 0;
    checkedIds.forEach((id) => { if (!visible.has(id)) hidden += 1; });
    return hidden;
  }, [checkedIds, checkedCount, pageIds]);

  const filterQuery = () => {
    const query = new URLSearchParams();
    if (orderFilter.trim()) query.set('orderId', orderFilter.trim());
    if (nameFilter.trim()) query.set('name', nameFilter.trim());
    if (mobileFilter.trim()) query.set('mobile', mobileFilter.trim());
    if (statusFilter) query.set('status', statusFilter);
    if (sourceFilter) query.set('source', sourceFilter);
    if (orderDate) query.set('orderDate', orderDate);
    if (dateFrom) query.set('dateFrom', dateFrom);
    if (dateTo) query.set('dateTo', dateTo);
    if (expectedFrom) query.set('expectedFrom', expectedFrom);
    if (expectedTo) query.set('expectedTo', expectedTo);
    if (urgencyFilter) query.set('urgency', urgencyFilter);
    return query;
  };

  const fetchOrders = async () => {
    const query = filterQuery();
    query.set('page', String(currentPage));
    query.set('limit', String(pageSize));
    const res = await fetch(`/api/orders?${query.toString()}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setOrders([]);
      setTotalOrders(0);
      setTotalPages(1);
      setLoading(false);
      if (data.error) toast.error(data.error);
      return;
    }
    const nextOrders = data.orders || [];
    setOrders(nextOrders);
    setTotalOrders(Number(data.total || 0));
    setTotalPages(Math.max(1, Number(data.pages || 1)));
    setLoading(false);
    if (selected?._id) setSelected(nextOrders.find((order) => order._id === selected._id) || null);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setOrderDate(params.get('orderDate') || '');
    setDateFrom(params.get('dateFrom') || '');
    setDateTo(params.get('dateTo') || '');
    setExpectedFrom(params.get('expectedFrom') || '');
    setExpectedTo(params.get('expectedTo') || '');
    setStatusFilter(params.get('status') || '');
    setUrgencyFilter(params.get('urgency') || '');
    setOrderFilter(params.get('orderId') || params.get('orderNumber') || '');
    setNameFilter(params.get('name') || '');
    setFiltersReady(true);
  }, []);

  useEffect(() => {
    if (!writable) return;
    // Backfill automatic Editor assignment for eligible unassigned orders (idempotent).
    fetch('/api/admin/editors/auto-assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit: 40 }),
    }).catch(() => {});
  }, [writable]);

  useEffect(() => {
    if (!filtersReady) return;
    if (dateError || expectedError) {
      setOrders([]);
      setTotalOrders(0);
      setTotalPages(1);
      setLoading(false);
      return;
    }
    fetchOrders();
  }, [filtersReady, currentPage, orderFilter, nameFilter, mobileFilter, statusFilter, sourceFilter, orderDate, dateFrom, dateTo, dateError, expectedFrom, expectedTo, expectedError, urgencyFilter]);

  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => setDeliveryHolidays(Array.isArray(data.deliveryHolidays) ? data.deliveryHolidays : []))
      .catch(() => setDeliveryHolidays([]));
  }, []);

  useEffect(() => {
    setTrackingDraft(selected?.trackingNumber || '');
  }, [selected?._id, selected?.trackingNumber]);

  const paginatedOrders = orders;

  useEffect(() => { setCurrentPage(1); }, [orderFilter, nameFilter, mobileFilter, statusFilter, orderDate, dateFrom, dateTo, expectedFrom, expectedTo, urgencyFilter]);
  useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages); }, [currentPage, totalPages]);
  useEffect(() => {
    if (selected?._id && !orders.some((order) => order._id === selected._id)) setSelected(null);
  }, [orders, selected?._id]);
  const updateStatus = async (id, status) => {
    if (!writable) return;
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
    if (!writable) return;
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

  const toggleChecked = (id, nextChecked) => {
    setCheckedIds((prev) => {
      const copy = new Set(prev);
      if (nextChecked) copy.add(String(id));
      else copy.delete(String(id));
      return copy;
    });
  };

  const selectCurrentPage = () => {
    setCheckedIds((prev) => {
      const copy = new Set(prev);
      pageIds.forEach((id) => copy.add(id));
      return copy;
    });
  };

  const clearSelection = () => setCheckedIds(new Set());

  const toggleSelectCurrentPage = () => {
    if (allPageSelected) {
      setCheckedIds((prev) => {
        const copy = new Set(prev);
        pageIds.forEach((id) => copy.delete(id));
        return copy;
      });
      return;
    }
    selectCurrentPage();
  };

  const selectAllMatching = async () => {
    if (selectingMatching || dateError) return;
    setSelectingMatching(true);
    try {
      const query = filterQuery();
      query.set('limit', String(MAX_SHIPPING_LABEL_ORDERS));
      const res = await fetch(`/api/admin/orders/ids?${query.toString()}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || 'Unable to select matching orders');
        return;
      }
      const ids = Array.isArray(data.ids) ? data.ids.map(String) : [];
      setCheckedIds(new Set(ids));
      if (data.capped) {
        toast.success(`Selected first ${ids.length} of ${data.total} matching orders (max ${data.max} for labels).`);
      } else {
        toast.success(`Selected ${ids.length} matching order${ids.length === 1 ? '' : 's'}.`);
      }
    } catch {
      toast.error('Unable to select matching orders');
    } finally {
      setSelectingMatching(false);
    }
  };

  const openLabelModal = () => {
    if (!checkedCount) return;
    if (checkedCount > MAX_SHIPPING_LABEL_ORDERS) {
      toast.error(`Select at most ${MAX_SHIPPING_LABEL_ORDERS} orders for shipping labels.`);
      return;
    }
    setLabelModalOpen(true);
  };

  const openLabelForOrder = (orderId) => {
    const id = String(orderId || '');
    if (!id) return;
    setCheckedIds(new Set([id]));
    setLabelModalOpen(true);
  };

  return (
    <div>
      <ReadOnlyBanner show={!writable} />
      <div className="mb-6 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Orders</h1>
          <p className="text-sm text-gray-500">Website (GG…) and WhatsApp/Instagram (G…) orders in one list. Dates use IST.</p>
        </div>
        <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
          {writable ? (
            <button
              type="button"
              onClick={() => setCreateWaOpen(true)}
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white sm:w-auto"
            >
              <FiPlus /> Create WhatsApp Order
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setOrderFilter('');
              setNameFilter('');
              setMobileFilter('');
              setStatusFilter('');
              setSourceFilter('');
              setOrderDate('');
              setDateFrom('');
              setDateTo('');
              setExpectedFrom('');
              setExpectedTo('');
              setUrgencyFilter('');
              setCurrentPage(1);
            }}
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold sm:w-auto"
          >
            <FiRefreshCw /> Reset filters
          </button>
          <DownloadCsvButton
            href={`/api/admin/orders/export?${filterQuery().toString()}`}
            fallbackName="orders.csv"
            disabled={!!dateError}
          />
        </div>
      </div>

      {readable ? (
        <div className="mb-4 rounded-xl border bg-white p-3 sm:p-4">
          <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 text-sm">
              <p className="font-semibold text-gray-900">{checkedCount} order{checkedCount === 1 ? '' : 's'} selected for labels</p>
              {hiddenSelectedCount > 0 ? (
                <p className="mt-1 text-xs text-amber-700">{hiddenSelectedCount} selected order{hiddenSelectedCount === 1 ? '' : 's'} hidden by the current page or filters — selection is kept by order ID.</p>
              ) : (
                <p className="mt-1 text-xs text-gray-500">Selection is kept when you change pages or filters. Use Select current page or Select all matching (capped).</p>
              )}
            </div>
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button type="button" onClick={selectCurrentPage} disabled={!pageIds.length} className="inline-flex min-h-[44px] items-center justify-center rounded-xl border px-3 py-2 text-sm font-semibold disabled:opacity-50">
                Select current page
              </button>
              <button type="button" onClick={selectAllMatching} disabled={!!dateError || selectingMatching} className="inline-flex min-h-[44px] items-center justify-center rounded-xl border px-3 py-2 text-sm font-semibold disabled:opacity-50">
                {selectingMatching ? 'Selecting…' : `Select all matching (max ${MAX_SHIPPING_LABEL_ORDERS})`}
              </button>
              <button type="button" onClick={clearSelection} disabled={!checkedCount} className="inline-flex min-h-[44px] items-center justify-center rounded-xl border px-3 py-2 text-sm font-semibold disabled:opacity-50">
                Clear selection
              </button>
              <button
                type="button"
                onClick={openLabelModal}
                disabled={!checkedCount}
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                Generate shipping labels ({checkedCount})
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className={`grid gap-6 ${selected ? 'xl:grid-cols-3' : ''}`}>
        <div className={`${selected ? 'xl:col-span-2' : ''} bg-white rounded-xl border overflow-hidden`}>
          <div className="grid min-w-0 gap-3 border-b bg-gray-50 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
            <div className="min-w-0">
              <label className="mb-1 block text-xs font-semibold text-gray-500">Order ID</label>
              <input value={orderFilter} onChange={(e) => { setOrderFilter(e.target.value); setCurrentPage(1); }} placeholder="GG0001 or G4746" className="min-h-[44px] w-full min-w-0 rounded-lg border px-3 py-2 text-sm" />
            </div>
            <div className="min-w-0">
              <label className="mb-1 block text-xs font-semibold text-gray-500">Source</label>
              <AdminSelect
                value={sourceFilter}
                onChange={(next) => { setSourceFilter(next); setCurrentPage(1); }}
                options={[
                  { value: '', label: 'All sources' },
                  { value: 'website', label: 'Website' },
                  { value: 'whatsapp', label: 'WhatsApp' },
                  { value: 'instagram', label: 'Instagram' },
                ]}
              />
            </div>
            <div className="min-w-0">
              <label className="mb-1 block text-xs font-semibold text-gray-500">Customer Name</label>
              <input value={nameFilter} onChange={(e) => { setNameFilter(e.target.value); setCurrentPage(1); }} placeholder="Search name" className="min-h-[44px] w-full min-w-0 rounded-lg border px-3 py-2 text-sm" />
            </div>
            <div className="min-w-0">
              <label className="mb-1 block text-xs font-semibold text-gray-500">Mobile Number</label>
              <input value={mobileFilter} onChange={(e) => { setMobileFilter(e.target.value); setCurrentPage(1); }} placeholder="Search mobile" className="min-h-[44px] w-full min-w-0 rounded-lg border px-3 py-2 text-sm" />
            </div>
            <div className="min-w-0">
              <label className="mb-1 block text-xs font-semibold text-gray-500">Status</label>
              <AdminSelect
                value={statusFilter}
                onChange={(next) => { setStatusFilter(next); setCurrentPage(1); }}
                options={statusFilterOptions}
              />
            </div>
            <div className="min-w-0">
              <label className="mb-1 block text-xs font-semibold text-gray-500">Order Date</label>
              <input
                type="date"
                value={orderDate}
                onChange={(e) => { setOrderDate(e.target.value); setCurrentPage(1); }}
                className="min-h-[44px] w-full min-w-0 rounded-lg border px-3 py-2 text-sm"
                title="Show orders created on this IST calendar day"
              />
            </div>
            <div className="min-w-0">
              <label className="mb-1 block text-xs font-semibold text-gray-500">Paid From</label>
              <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }} className="min-h-[44px] w-full min-w-0 rounded-lg border px-3 py-2 text-sm" />
            </div>
            <div className="min-w-0">
              <label className="mb-1 block text-xs font-semibold text-gray-500">Paid To</label>
              <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }} className="min-h-[44px] w-full min-w-0 rounded-lg border px-3 py-2 text-sm" />
            </div>
            <div className="min-w-0">
              <label className="mb-1 block text-xs font-semibold text-gray-500">Expected dispatch From</label>
              <input type="date" value={expectedFrom} onChange={(e) => { setExpectedFrom(e.target.value); setCurrentPage(1); }} className="min-h-[44px] w-full min-w-0 rounded-lg border px-3 py-2 text-sm" />
            </div>
            <div className="min-w-0">
              <label className="mb-1 block text-xs font-semibold text-gray-500">Expected dispatch To</label>
              <input type="date" value={expectedTo} onChange={(e) => { setExpectedTo(e.target.value); setCurrentPage(1); }} className="min-h-[44px] w-full min-w-0 rounded-lg border px-3 py-2 text-sm" />
            </div>
            <div className="min-w-0 sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-gray-500">Expected dispatch shortcuts</label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="min-h-[40px] rounded-lg border bg-white px-3 py-1.5 text-xs font-semibold"
                  onClick={() => {
                    const d = todayIstYmd();
                    setExpectedFrom(d);
                    setExpectedTo(d);
                    setCurrentPage(1);
                  }}
                >
                  Today
                </button>
                <button
                  type="button"
                  className="min-h-[40px] rounded-lg border bg-white px-3 py-1.5 text-xs font-semibold"
                  onClick={() => {
                    const d = tomorrowIstYmd();
                    setExpectedFrom(d);
                    setExpectedTo(d);
                    setCurrentPage(1);
                  }}
                >
                  Tomorrow
                </button>
                <button
                  type="button"
                  className="min-h-[40px] rounded-lg border bg-white px-3 py-1.5 text-xs font-semibold text-gray-600"
                  onClick={() => {
                    setExpectedFrom('');
                    setExpectedTo('');
                    setCurrentPage(1);
                  }}
                >
                  Clear dates
                </button>
              </div>
            </div>
            <div className="min-w-0">
              <label className="mb-1 block text-xs font-semibold text-gray-500">Priority</label>
              <AdminSelect
                value={urgencyFilter}
                onChange={(next) => { setUrgencyFilter(next); setCurrentPage(1); }}
                options={[
                  { value: '', label: 'All priorities' },
                  { value: 'normal', label: 'Normal' },
                  { value: 'urgent', label: 'Urgent' },
                ]}
              />
            </div>
            {dateError ? <p className="text-sm text-red-600 sm:col-span-2 lg:col-span-3 xl:col-span-6">{dateError}</p> : null}
            {expectedError ? <p className="text-sm text-red-600 sm:col-span-2 lg:col-span-3 xl:col-span-6">{expectedError}</p> : null}
          </div>

          {loading ? <p className="p-6 text-center">Loading...</p> : (<>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[1400px]">
                <thead>
                  <tr className="bg-gray-50 text-left text-gray-600">
                    <th className="p-4 w-12">
                      <input
                        type="checkbox"
                        checked={allPageSelected}
                        ref={(el) => { if (el) el.indeterminate = somePageSelected; }}
                        onChange={toggleSelectCurrentPage}
                        aria-label="Select current page"
                        className="h-4 w-4 rounded border-gray-300"
                      />
                    </th>
                    <th className="p-4">SNO</th>
                    <th className="p-4">Order ID</th>
                    <th className="p-4">Source</th>
                    <th className="p-4">Order Date</th>
                    <th className="p-4">Name</th>
                    <th className="p-4">Mobile</th>
                    <th className="p-4">City</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Assigned</th>
                    <th className="p-4">Dispatch</th>
                    <th className="p-4">Payment</th>
                    <th className="p-4 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedOrders.map((order, idx) => {
                    const outOfTn = isOrderOutOfTamilNadu(order);
                    const normalized = normalizeStatus(order.status);
                    const id = String(order._id);
                    const isChecked = checkedIds.has(id);
                    return (
                      <tr key={order._id} className={`border-t hover:bg-gray-50 ${selected?._id === order._id ? 'bg-primary-50' : ''} ${isChecked ? 'bg-sky-50/60' : ''}`}>
                        <td className="p-4" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => toggleChecked(id, e.target.checked)}
                            aria-label={`Select order ${order.orderNumber}`}
                            className="h-4 w-4 rounded border-gray-300"
                          />
                        </td>
                        <td className="p-4 font-semibold text-gray-500 cursor-pointer" onClick={() => setSelected((current) => current?._id === order._id ? null : order)}>{(currentPage - 1) * pageSize + idx + 1}</td>
                        <td className="p-4 font-bold text-primary-700 cursor-pointer" onClick={() => setSelected((current) => current?._id === order._id ? null : order)}>{order.orderNumber}</td>
                        <td className="p-4 cursor-pointer" onClick={() => setSelected((current) => current?._id === order._id ? null : order)}>
                          <div className="flex flex-wrap items-center gap-1">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${order.orderSource === 'whatsapp' ? 'bg-green-50 text-green-800 border border-green-200' : order.orderSource === 'instagram' ? 'bg-pink-50 text-pink-800 border border-pink-200' : 'bg-sky-50 text-sky-800 border border-sky-200'}`}>
                              {ORDER_SOURCE_LABELS[order.orderSource] || 'Website'}
                            </span>
                            {order.orderPriority === 'urgent' ? (
                              <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide text-amber-900">Urgent</span>
                            ) : null}
                          </div>
                        </td>
                        <td className="p-4 text-gray-600 whitespace-nowrap cursor-pointer" onClick={() => setSelected((current) => current?._id === order._id ? null : order)}>{formatDate(order.paidAt || order.createdAt)}</td>
                        <td className="p-4 cursor-pointer" onClick={() => setSelected((current) => current?._id === order._id ? null : order)}><p className="font-medium text-gray-900">{order.shippingAddress?.fullName || '-'}</p><p className="text-xs text-gray-500">{order.shippingAddress?.email || order.guestEmail || '-'}</p></td>
                        <td className="p-4 font-medium whitespace-nowrap cursor-pointer" onClick={() => setSelected((current) => current?._id === order._id ? null : order)}><p>{order.shippingAddress?.phone || '-'}</p>{order.shippingAddress?.whatsappNumber && <p className="text-xs text-green-700">WA: {order.shippingAddress.whatsappNumber}</p>}</td>
                        <td className="p-4 max-w-[160px] cursor-pointer" onClick={() => setSelected((current) => current?._id === order._id ? null : order)}><p className="font-medium text-gray-700 break-words">{order.shippingAddress?.city || '-'}</p>{outOfTn && <span className="mt-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Outside TN</span>}</td>
                        <td className="p-4 cursor-pointer" onClick={() => setSelected((current) => current?._id === order._id ? null : order)}>
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusColors[normalized] || statusColors.ordered}`}>{statusLabels[normalized] || normalized}</span>
                          {order.opsStatus ? <p className="mt-1 text-[11px] text-gray-500">{OPS_STATUS_LABELS[order.opsStatus] || order.opsStatus}</p> : null}
                        </td>
                        <td className="p-4 text-xs cursor-pointer" onClick={() => setSelected((current) => current?._id === order._id ? null : order)}>{order.assignedToName || '—'}</td>
                        <td className="p-4 text-xs cursor-pointer" onClick={() => setSelected((current) => current?._id === order._id ? null : order)}>
                          {order.expectedDispatchDate ? formatDate(order.expectedDispatchDate) : '—'}
                          {isDelayedOrder(order) ? <span className="mt-1 block font-semibold text-red-600">Delayed</span> : null}
                        </td>
                        <td className="p-4 cursor-pointer" onClick={() => setSelected((current) => current?._id === order._id ? null : order)}><span className={`px-2 py-1 rounded-full text-xs font-semibold ${paymentStatusColors[order.paymentStatus] || paymentStatusColors.pending}`}>{order.paymentMethod || 'Cashfree'} {order.paymentStatus}</span></td>
                        <td className="p-4 text-right font-medium cursor-pointer" onClick={() => setSelected((current) => current?._id === order._id ? null : order)}>{formatPrice(order.total)}</td>
                      </tr>
                    );
                  })}
                  {orders.length === 0 && <tr><td colSpan={10} className="p-6 text-center text-gray-500">No orders match your filters</td></tr>}
                </tbody>
              </table>
            </div>
          {totalOrders > pageSize && (
            <div className="flex flex-col gap-3 border-t bg-gray-50 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="text-gray-500">Showing {totalOrders === 0 ? 0 : (currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, totalOrders)} of {totalOrders} orders</p>
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
        <div className="min-w-0 max-w-full overflow-hidden bg-white rounded-xl border p-5 md:p-6">
            <div className="min-w-0">
              <h2 className="font-bold text-lg mb-4 break-words">Order {selected.orderNumber}</h2>
              <div className="min-w-0 space-y-3 text-sm break-words">
                {selected.shippingAddress && (
                  <div className="pt-2">
                    <h3 className="font-semibold mt-4 mb-2">Shipping</h3>
                    <div className="min-w-0 rounded-lg border bg-gray-50 p-3 space-y-1 break-words">
                      <p className="font-semibold">{selected.shippingAddress.fullName}</p>
                      <p>Mobile: {selected.shippingAddress.phone}</p>{selected.shippingAddress.whatsappNumber && <p>WhatsApp: {selected.shippingAddress.whatsappNumber}</p>}
                      <p>{selected.shippingAddress.line1}</p>
                      {selected.shippingAddress.line2 && <p>{selected.shippingAddress.line2}</p>}
                      <p>{selected.shippingAddress.city}, {selected.shippingAddress.state}{selected.shippingAddress.pincode ? ` - ${selected.shippingAddress.pincode}` : ''}</p>
                      <p>{selected.shippingAddress.email || selected.guestEmail}</p>
                    </div>
                  </div>
                )}

                {isOrderOutOfTamilNadu(selected) && (
                  <div className="min-w-0 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800 break-words">
                    Outside Tamil Nadu order. Delivery charge applies and timeline is usually 10 to 15 days.
                  </div>
                )}
                <div><span className="text-gray-500">Order date:</span> {formatDate(selected.paidAt || selected.createdAt)}</div>
                {selected.confirmationSchedule?.expectedReadyDateIst ? (
                  <div><span className="text-gray-500">Expected ready:</span> <span className="font-medium">{formatLongIstDate(selected.confirmationSchedule.expectedReadyDateIst)}</span></div>
                ) : null}
                <div className="break-words"><span className="text-gray-500">Estimated delivery:</span> <span className="font-medium">{getOrderDeliveryEstimate(selected, deliveryHolidays) || '-'}</span></div>
                {selected.notes && <div className="min-w-0 rounded-lg border bg-yellow-50 p-3 break-words"><span className="text-gray-500">Customer note:</span> <p className="font-medium text-gray-900 whitespace-pre-wrap">{selected.notes}</p></div>}
                <div>
                  <span className="text-gray-500">Status:</span>
                  <select disabled={!writable} value={normalizeStatus(selected.status)} onChange={e => updateStatus(selected._id, e.target.value)} className="ml-2 border rounded px-2 py-1 text-sm disabled:bg-gray-100">
                    {statusOptions.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-gray-500">Payment:</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${paymentStatusColors[selected.paymentStatus] || paymentStatusColors.pending}`}>{selected.paymentStatus}</span>
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{selected.paymentMethod || 'Cashfree'}</span>
                </div>
                {readable ? (
                  <button
                    type="button"
                    onClick={() => openLabelForOrder(selected._id)}
                    className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-primary-200 bg-primary-50 px-4 py-2 text-sm font-semibold text-primary-800"
                  >
                    Print / download shipping label
                  </button>
                ) : null}

                {selected.historicalWhatsAppOrderRef || selected.customerKind ? (
                  <div className="rounded-lg border bg-sky-50/60 px-3 py-2 text-xs text-gray-700">
                    {selected.customerKind === 'existing_whatsapp' ? <p><strong>Existing WhatsApp customer</strong></p> : null}
                    {selected.customerKind === 'new' ? <p><strong>New customer</strong></p> : null}
                    {selected.historicalWhatsAppOrderRef ? (
                      <p>Historical WA order ref: <span className="font-mono font-semibold">{selected.historicalWhatsAppOrderRef}</span> (reference only)</p>
                    ) : null}
                  </div>
                ) : null}

                <OrderOpsPanel
                  order={selected}
                  writable={writable}
                  onUpdated={async () => {
                    await fetchOrders();
                  }}
                />

                <OrderDesignSheetsPanel
                  order={selected}
                  writable={writable}
                  onUpdated={async () => {
                    await fetchOrders();
                  }}
                />

                <div className="min-w-0 border rounded-lg p-3 bg-gray-50 space-y-2 break-words">
                  <p className="text-xs text-gray-600 leading-relaxed"><strong>ST Couriers tracking ID:</strong> after booking the parcel with ST Couriers, paste the tracking ID here. Customers can copy it and open the ST website.</p>
                  <label className="text-xs font-medium text-gray-700">Tracking ID</label>
                  <input disabled={!writable} value={trackingDraft} onChange={(e) => setTrackingDraft(e.target.value)} placeholder="Enter ST Couriers tracking ID" className="min-w-0 max-w-full border rounded-lg px-3 py-2 text-sm font-mono w-full disabled:bg-gray-100" />
                  {writable && <button type="button" onClick={() => updateTracking(selected._id, trackingDraft)} className="text-sm px-4 py-2 rounded-lg bg-primary-600 text-white font-semibold hover:bg-primary-700">Save tracking ID</button>}
                </div>

                <h3 className="font-semibold mt-4">Items</h3>
                <div className="min-w-0 space-y-3">
                  {selected.items?.map((item, idx) => (
                    <div key={idx} className="min-w-0 max-w-full overflow-hidden rounded-lg border bg-gray-50 p-3 space-y-2">
                      <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3"><div className="min-w-0"><p className="font-semibold text-gray-900 break-words">{item.title} x{item.quantity}</p>{item.variant && <p className="text-xs text-gray-500 break-words">Selected: {item.variant}</p>}</div><span className="font-semibold whitespace-nowrap sm:self-start">{formatPrice(item.price * item.quantity)}</span></div>
                      {item.customFields && Object.keys(item.customFields).length > 0 && (
                        <div className="min-w-0 max-w-full overflow-hidden rounded-md bg-white border p-2 space-y-1 break-words"><p className="text-xs font-semibold text-gray-600">Customization</p>{Object.entries(item.customFields).map(([label, value]) => (<div key={label} className="min-w-0 text-xs text-gray-700 break-words"><span className="font-medium">{label}: </span><CustomValue value={value} /></div>))}</div>
                      )}
                      {item.collageUploads && <CollageUploadDetails groups={item.collageUploads} />}
                      {item.customizationPreview && <PreviewDetails preview={item.customizationPreview} />}
                    </div>
                  ))}
                </div>
                <div className="min-w-0 border-t pt-2 space-y-1"><div className="flex justify-between gap-3"><span>Subtotal</span><span className="whitespace-nowrap">{formatPrice(selected.subtotal || 0)}</span></div><div className="flex justify-between gap-3"><span>Delivery</span><span className="whitespace-nowrap">{selected.shippingCost === 0 ? 'FREE' : formatPrice(selected.shippingCost || 0)}</span></div><div className="flex justify-between gap-3 font-bold"><span>Total</span><span className="whitespace-nowrap">{formatPrice(selected.total)}</span></div></div>



              </div>
            </div>
          </div>
        )}
      </div>

      <ShippingLabelModal
        open={labelModalOpen}
        orderIds={selectedLabelIds}
        onClose={() => setLabelModalOpen(false)}
        onOpenOrder={async (id) => {
          setLabelModalOpen(false);
          const onPage = orders.find((order) => String(order._id) === String(id));
          if (onPage) {
            setSelected(onPage);
            return;
          }
          try {
            const res = await fetch(`/api/orders/${id}`, { cache: 'no-store' });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data?._id) setSelected(data);
            else toast.error('Unable to open that order');
          } catch {
            toast.error('Unable to open that order');
          }
        }}
      />
      <CreateWhatsAppOrderModal
        open={createWaOpen}
        onClose={() => setCreateWaOpen(false)}
        onCreated={() => {
          setCurrentPage(1);
          setSourceFilter('whatsapp');
          fetchOrders();
        }}
      />
    </div>
  );
}

