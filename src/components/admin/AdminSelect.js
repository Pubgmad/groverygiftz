'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiChevronDown } from 'react-icons/fi';

export default function AdminSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Select',
  disabled = false,
  className = '',
  buttonClassName = '',
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const uid = useId();
  const selected = options.find((item) => String(item.value) === String(value));

  const updateCoords = () => {
    const el = buttonRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const viewport = window.visualViewport;
    const viewWidth = viewport?.width || window.innerWidth;
    const viewHeight = viewport?.height || window.innerHeight;
    const gutter = 8;
    const width = Math.min(Math.max(rect.width, 180), Math.max(160, viewWidth - gutter * 2));
    const left = Math.max(gutter, Math.min(rect.left, viewWidth - width - gutter));
    const spaceBelow = viewHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUp = spaceBelow < 220 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(140, Math.min(280, (openUp ? spaceAbove : spaceBelow) - 12));
    setCoords({
      top: openUp ? undefined : rect.bottom + 4,
      bottom: openUp ? viewHeight - rect.top + 4 : undefined,
      left,
      width,
      maxHeight,
    });
  };

  useEffect(() => {
    if (!open) return undefined;
    updateCoords();
    const onWin = () => updateCoords();
    const onDoc = (event) => {
      if (buttonRef.current?.contains(event.target) || menuRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('resize', onWin);
    window.addEventListener('scroll', onWin, true);
    window.visualViewport?.addEventListener('resize', onWin);
    window.visualViewport?.addEventListener('scroll', onWin);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('touchstart', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', onWin);
      window.removeEventListener('scroll', onWin, true);
      window.visualViewport?.removeEventListener('resize', onWin);
      window.visualViewport?.removeEventListener('scroll', onWin);
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('touchstart', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const menu = open && coords && typeof document !== 'undefined'
    ? createPortal(
      <ul
        ref={menuRef}
        id={`${uid}-list`}
        role="listbox"
        className="fixed z-[80] overflow-y-auto rounded-xl border bg-white py-1 shadow-lg"
        style={{
          top: coords.top,
          bottom: coords.bottom,
          left: coords.left,
          width: coords.width,
          maxHeight: coords.maxHeight,
        }}
      >
        {options.length === 0 ? (
          <li className="px-3 py-3 text-sm text-gray-500">{placeholder}</li>
        ) : options.map((item) => (
          <li key={String(item.value)}>
            <button
              type="button"
              role="option"
              aria-selected={String(item.value) === String(value)}
              className={`flex min-h-[44px] w-full items-center px-3 text-left text-sm leading-5 ${String(item.value) === String(value) ? 'bg-primary-50 font-semibold text-primary-800' : 'hover:bg-gray-50'}`}
              onClick={() => {
                onChange(item.value);
                setOpen(false);
              }}
            >
              <span className="min-w-0 break-words">{item.label}</span>
            </button>
          </li>
        ))}
      </ul>,
      document.body,
    )
    : null;

  return (
    <div className={`relative min-w-0 ${className}`}>
      <button
        type="button"
        ref={buttonRef}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => { if (!disabled) setOpen((current) => !current); }}
        className={`flex min-h-[44px] w-full min-w-0 items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2.5 text-left text-sm disabled:bg-gray-100 ${buttonClassName}`}
      >
        <span className={`min-w-0 truncate ${selected ? 'text-gray-900' : 'text-gray-500'}`}>{selected?.label || placeholder}</span>
        <FiChevronDown className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {menu}
    </div>
  );
}
