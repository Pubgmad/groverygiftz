'use client';
import { useState } from 'react';
import { FiEye, FiEyeOff } from 'react-icons/fi';

export default function PasswordInput({ className = '', inputClassName = '', ...props }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className={`relative ${className}`}>
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        className={`${inputClassName || 'w-full border rounded-lg px-4 py-3 focus:outline-none focus:border-primary-500'} pr-12`}
      />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-primary-600"
        aria-label={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? <FiEyeOff size={18} /> : <FiEye size={18} />}
      </button>
    </div>
  );
}
