'use client';

import { useId, useMemo, useState } from 'react';
import { FiPlay } from 'react-icons/fi';

function VideoCard({ video, playingId, setPlayingId }) {
  const isPlaying = playingId === video.id;
  return (
    <article className="w-[78vw] max-w-[280px] shrink-0 snap-start overflow-hidden rounded-3xl border border-primary-100 bg-white shadow-sm sm:w-[260px]">
      <div className="relative aspect-[9/14] bg-gray-900">
        {isPlaying && video.url ? (
          <video
            src={video.url}
            poster={video.poster || undefined}
            controls
            autoPlay
            playsInline
            preload="metadata"
            className="h-full w-full object-cover"
            onEnded={() => setPlayingId('')}
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlayingId(video.id)}
            className="group relative h-full w-full overflow-hidden text-left"
            aria-label={`Play ${video.title || 'video'}`}
          >
            {video.poster ? (
              <img src={video.poster} alt="" loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary-900 to-primary-700">
                <span className="px-4 text-center text-sm font-semibold text-white/90">{video.title || 'Watch video'}</span>
              </div>
            )}
            <span className="absolute inset-0 bg-black/20" />
            <span className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-accent-500 text-white shadow-lg transition group-hover:scale-105">
              <FiPlay size={22} className="ml-0.5" aria-hidden />
            </span>
          </button>
        )}
      </div>
      <div className="space-y-1 px-4 py-3">
        {video.title ? <h3 className="font-display text-base font-bold text-gray-950">{video.title}</h3> : null}
        {video.description ? <p className="text-sm leading-5 text-gray-500">{video.description}</p> : null}
      </div>
    </article>
  );
}

export default function ProductMakingVideos({ product }) {
  const baseId = useId();
  const [playingId, setPlayingId] = useState('');
  const section = product?.makingVideosSection || {};
  const videos = useMemo(() => {
    if (section.enabled === false) return [];
    return (product?.makingVideos || [])
      .filter((video) => video?.isActive !== false && String(video?.url || '').trim())
      .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))
      .map((video, index) => ({
        id: `${baseId}-${index}`,
        url: video.url,
        poster: video.poster || '',
        title: String(video.title || '').trim(),
        description: String(video.description || '').trim(),
      }));
  }, [baseId, product?.makingVideos, section.enabled]);

  if (videos.length === 0) return null;
  const heading = String(section.heading || '').trim() || 'See How Your Gift Is Made';

  return (
    <section className="mt-10 border-t border-gray-100 pt-8" aria-labelledby={`${baseId}-heading`}>
      <div className="mb-4 px-0.5">
        <h2 id={`${baseId}-heading`} className="font-display text-xl font-bold text-primary-900 sm:text-2xl">
          {heading}
        </h2>
        <p className="mt-1 text-sm text-gray-500">Real production footage from our workshop. Tap a card to watch.</p>
      </div>
      <div className="flex gap-3 overflow-x-auto overscroll-x-contain pb-2 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {videos.map((video) => (
          <VideoCard key={video.id} video={video} playingId={playingId} setPlayingId={setPlayingId} />
        ))}
      </div>
    </section>
  );
}
