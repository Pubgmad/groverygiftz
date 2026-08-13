'use client';
import { useRef, useState } from 'react';
import { FiLoader, FiUpload, FiX } from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function ImageUploader({ images, value = '', onChange, label = 'Upload', replaceOnUpload = false, deleteOnRemove = false, confirmRemove = false }) {
  const currentImages = Array.isArray(images) ? images : (value ? [value] : []);
  const isSingleValue = !Array.isArray(images) && typeof value === 'string';
  const emitChange = (nextImages) => {
    if (isSingleValue) onChange?.(nextImages[0] || '');
    else onChange?.(nextImages);
  };
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  const deleteUploadedFile = async (url) => {
    if (!deleteOnRemove || !(url?.startsWith('/uploads/') || url?.startsWith('/media/uploads/'))) return;
    try {
      const res = await fetch('/api/upload', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to delete image file');
    } catch (error) {
      toast.error(error.message || 'Image removed from settings, but file deletion failed');
    }
  };

  const handleUpload = async (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0 || uploading) return;

    const files = replaceOnUpload ? selectedFiles.slice(0, 1) : selectedFiles;
    setUploading(true);
    const uploaded = [];

    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);
      try {
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Failed to upload ${file.name}`);
        uploaded.push(data.url);
      } catch (error) {
        toast.error(error.message || `Failed to upload ${file.name}`);
      }
    }

    if (uploaded.length > 0) {
      if (replaceOnUpload) {
        await Promise.all(currentImages.filter(Boolean).map(deleteUploadedFile));
        emitChange(uploaded);
      } else {
        emitChange([...currentImages, ...uploaded]);
      }
      toast.success(uploaded.length === 1 ? 'Image uploaded' : `${uploaded.length} images uploaded`);
    }

    if (inputRef.current) inputRef.current.value = '';
    setUploading(false);
  };

  const removeImage = async (idx) => {
    if (uploading) return;
    const image = currentImages[idx];
    if (confirmRemove && !window.confirm('Remove this image permanently?')) return;
    await deleteUploadedFile(image);
    emitChange(currentImages.filter((_, i) => i !== idx));
    toast.success('Image removed');
  };

  const uploadTile = (label) => (
    <label className={`relative flex h-24 w-24 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed hover:bg-gray-50 ${uploading ? 'pointer-events-none opacity-80' : ''}`}>
      {uploading && <span className="absolute inset-0 z-0 rounded-lg bg-white/80" />}
      {uploading ? <span className="relative z-10 mb-1 h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-primary-600" /> : <FiUpload className="mb-1 text-gray-400" />}
      <span className="relative z-10 text-xs font-semibold text-gray-500">{uploading ? 'Uploading...' : label}</span>
      <input ref={inputRef} type="file" multiple={!replaceOnUpload} accept="image/*,.svg,.avif" onChange={handleUpload} className="hidden" disabled={uploading} />
    </label>
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3">
        {currentImages.map((img, idx) => (
          <div key={img || idx} className="group relative h-24 w-24 overflow-hidden rounded-lg border bg-gray-50">
            <img src={img} alt="" className="h-full w-full object-contain" />
            <button type="button" onClick={() => removeImage(idx)}
              className="absolute right-1 top-1 rounded-full bg-red-500 p-1 text-white opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100" aria-label="Remove image">
              <FiX size={12} />
            </button>
          </div>
        ))}
        {(!replaceOnUpload || currentImages.length === 0) && uploadTile(label)}
        {replaceOnUpload && currentImages.length > 0 && uploadTile('Replace')}
      </div>
    </div>
  );
}