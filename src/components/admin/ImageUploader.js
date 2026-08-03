'use client';
import { useState } from 'react';
import { FiUpload, FiX } from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function ImageUploader({ images = [], onChange }) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);
    const uploaded = [];
    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);
      try {
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (res.ok) uploaded.push(data.url);
        else toast.error(`Failed to upload ${file.name}`);
      } catch {
        toast.error(`Failed to upload ${file.name}`);
      }
    }
    onChange([...images, ...uploaded]);
    setUploading(false);
  };

  const removeImage = (idx) => {
    onChange(images.filter((_, i) => i !== idx));
  };

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-4">
        {images.map((img, idx) => (
          <div key={idx} className="relative w-24 h-24 rounded-lg overflow-hidden border group">
            <img src={img} alt="" className="w-full h-full object-cover" />
            <button type="button" onClick={() => removeImage(idx)}
              className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <FiX size={12} />
            </button>
          </div>
        ))}
        <label className="w-24 h-24 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50">
          <FiUpload className="text-gray-400 mb-1" />
          <span className="text-xs text-gray-400">{uploading ? 'Uploading...' : 'Upload'}</span>
          <input type="file" multiple accept="image/*" onChange={handleUpload} className="hidden" disabled={uploading} />
        </label>
      </div>
    </div>
  );
}
