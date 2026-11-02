'use client';

import { useState } from 'react';
import { FiFile, FiImage } from 'react-icons/fi';
import { getConfiguredImageSections, isImageAsset } from '@/lib/configuredImages';

const linkUrlFor = (asset) => {
  const originalUrl = String(asset?.originalUrl || '');
  if (originalUrl.includes('/api/customization-upload/original-file/')) return asset.url;
  return originalUrl || asset.url;
};

function Thumbnail({ asset, sectionLabel, tileSize, assetIndex }) {
  const [failed, setFailed] = useState(false);
  const href = linkUrlFor(asset);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={asset.caption || asset.name || sectionLabel}
      className={`group relative block shrink-0 overflow-hidden rounded-md border border-gray-200 bg-gray-50 ${tileSize}`}
    >
      {isImageAsset(asset) && !failed ? (
        <img
          src={asset.url}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="flex h-full w-full flex-col items-center justify-center gap-1 px-1 text-center text-[10px] font-semibold text-gray-500">
          <FiFile size={16} />
          {failed ? (
            <span className="line-clamp-2">Unavailable</span>
          ) : (
            <span className="line-clamp-2">{asset.name || 'File'}</span>
          )}
        </span>
      )}
      <span className="sr-only">{asset.caption || `${sectionLabel} ${assetIndex + 1}`}</span>
    </a>
  );
}

export default function ConfiguredImageSections({
  item,
  compact = false,
  includeCollage = false,
  includeProductImages,
}) {
  const sections = getConfiguredImageSections(item, {
    includeCollage,
    includeProductImages: includeProductImages ?? !compact,
  });
  if (sections.length === 0) return null;

  const tileSize = compact ? 'h-14 w-14' : 'h-16 w-16 sm:h-20 sm:w-20';
  const gridClass = compact
    ? 'flex max-w-full min-w-0 gap-2 overflow-x-auto pb-1 snap-x'
    : 'flex flex-wrap gap-2';

  return (
    <div className={compact ? 'mt-2 max-w-full min-w-0 space-y-2' : 'mt-3 space-y-3'}>
      {sections.map((section, sectionIndex) => (
        <div
          key={`${section.label}-${sectionIndex}`}
          className="max-w-full min-w-0 overflow-hidden rounded-lg border border-gray-100 bg-white/80 p-2"
        >
          <div className="mb-1.5 flex min-w-0 items-center justify-between gap-2 text-[11px] font-bold uppercase tracking-wide text-gray-600">
            <span className="flex min-w-0 items-center gap-1.5">
              <FiImage size={12} className="shrink-0 text-primary-600" />
              <span className="min-w-0 truncate">{section.label}</span>
            </span>
            {compact ? (
              <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold normal-case text-gray-600">
                {section.items.length} photo{section.items.length === 1 ? '' : 's'}
              </span>
            ) : null}
          </div>
          <div className={gridClass}>
            {section.items.map((asset, assetIndex) => (
              <div key={`${asset.url}-${assetIndex}`} className="snap-start">
                <Thumbnail
                  asset={asset}
                  sectionLabel={section.label}
                  tileSize={tileSize}
                  assetIndex={assetIndex}
                />
              </div>
            ))}
          </div>
          {!compact && section.items.length > 0 ? (
            <p className="mt-1 line-clamp-2 break-words text-[11px] text-gray-500">
              {section.items.map((asset) => asset.caption || asset.name).filter(Boolean).join(', ')}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
