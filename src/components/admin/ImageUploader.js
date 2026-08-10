'use client';
import { useRef, useState } from 'react';
import { FiUpload, FiX } from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function ImageUploader({ images = [], onChange, replaceOnUpload = false, deleteOnRemove = false, confirmRemove = false }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  const deleteUploadedFile = async (url) => {
    if (!deleteOnRemove || !url?.startsWith('/uploads/')) return;
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
    if (selectedFiles.length === 0) return;

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
        await Promise.all(images.filter(Boolean).map(deleteUploadedFile));
        onChange(uploaded);
      } else {
        onChange([...images, ...uploaded]);
      }
      toast.success(uploaded.length === 1 ? 'Image uploaded' : `${uploaded.length} images uploaded`);
    }

    if (inputRef.current) inputRef.current.value = '';
    setUploading(false);
  };

  const removeImage = async (idx) => {
    const image = images[idx];
    if (confirmRemove && !window.confirm('Remove this image permanently?')) return;
    await deleteUploadedFile(image);
    onChange(images.filter((_, i) => i !== idx));
    toast.success('Image removed');
  };

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-4">
        {images.map((img, idx) => (
          <div key={img || idx} className="relative w-24 h-24 rounded-lg overflow-hidden border group bg-gray-50">
            <img src={img} alt="" className="w-full h-full object-contain" />
            <button type="button" onClick={() => removeImage(idx)}
              className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity" aria-label="Remove image">
              <FiX size={12} />
            </button>
          </div>
        ))}
        {(!replaceOnUpload || images.length === 0) && (
          <label className="w-24 h-24 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50">
            <FiUpload className="text-gray-400 mb-1" />
            <span className="text-xs text-gray-400">{uploading ? 'Uploading...' : 'Upload'}</span>
            <input ref={inputRef} type="file" multiple={!replaceOnUpload} accept="image/*,.svg,.avif" onChange={handleUpload} className="hidden" disabled={uploading} />
          </label>
        )}
        {replaceOnUpload && images.length > 0 && (
          <label className="w-24 h-24 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50">
            <FiUpload className="text-gray-400 mb-1" />
            <span className="text-xs text-gray-400">{uploading ? 'Uploading...' : 'Replace'}</span>
            <input ref={inputRef} type="file" accept="image/*,.svg,.avif" onChange={handleUpload} className="hidden" disabled={uploading} />
          </label>
        )}
      </div>
    </div>
  );
}
