'use client';
import { useState, useRef } from 'react';

export default function BeforeAfterSlider({ beforeImage, afterImage, title, description }) {
  const [sliderPos, setSliderPos] = useState(50);
  const containerRef = useRef(null);
  const dragging = useRef(false);

  const handleMove = (clientX) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pos = ((clientX - rect.left) / rect.width) * 100;
    setSliderPos(Math.max(0, Math.min(100, pos)));
  };

  return (
    <section className="max-w-7xl mx-auto px-4 py-12 md:py-16">
      <div className="text-center mb-8">
        <h2 className="section-title">{title || 'Fire Photo Frame'}</h2>
        {description && <p className="text-gray-500 mt-2 text-lg italic">&quot;{description}&quot;</p>}
      </div>
      <div className="max-w-3xl mx-auto">
        <div
          ref={containerRef}
          className="relative aspect-[4/3] overflow-hidden rounded-2xl select-none cursor-col-resize"
          onMouseDown={() => { dragging.current = true; }}
          onMouseUp={() => { dragging.current = false; }}
          onMouseLeave={() => { dragging.current = false; }}
          onMouseMove={(e) => { if (dragging.current) handleMove(e.clientX); }}
          onTouchMove={(e) => handleMove(e.touches[0].clientX)}
        >
          {/* After image (full) */}
          <div className="absolute inset-0">
            {afterImage ? (
              <img src={afterImage} alt="After" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white text-2xl font-bold">After</div>
            )}
          </div>
          {/* Before image (clipped) */}
          <div className="absolute inset-0 overflow-hidden" style={{ width: `${sliderPos}%` }}>
            {beforeImage ? (
              <img src={beforeImage} alt="Before" className="w-full h-full object-cover" style={{ width: `${(100 / sliderPos) * 100}%`, maxWidth: 'none' }} />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-2xl font-bold" style={{ width: containerRef.current?.offsetWidth || '100%' }}>Before</div>
            )}
          </div>
          {/* Slider line */}
          <div className="absolute top-0 bottom-0 w-1 bg-white shadow-lg" style={{ left: `${sliderPos}%`, transform: 'translateX(-50%)' }}>
            <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M7 4L3 10L7 16M13 4L17 10L13 16" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
