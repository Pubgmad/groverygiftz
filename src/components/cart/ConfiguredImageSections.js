'use client';

import { FiFile, FiImage } from 'react-icons/fi';
import { getConfiguredImageSections, isImageAsset } from '@/lib/configuredImages';

export default function ConfiguredImageSections({ item, compact = false, includeCollage = false }) {
  const sections = getConfiguredImageSections(item, { includeCollage, includeProductImages: true });
  if (sections.length === 0) return null;

  const tileSize = compact ? 'h-14 w-14' : 'h-16 w-16 sm:h-20 sm:w-20';
  const gridClass = compact ? 'flex gap-2 overflow-x-auto pb-1' : 'flex flex-wrap gap-2';

  return (
    <div className={compact ? 'mt-2 space-y-2' : 'mt-3 space-y-3'}>
      {sections.map((section, sectionIndex) => (
        <div key={`${section.label}-${sectionIndex}`} className="rounded-lg border border-gray-100 bg-white/80 p-2">
          <div className="mb-1.5 flex min-w-0 items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-600">
            <FiImage size={12} className="text-primary-600" />
            <span className="min-w-0 break-words">{section.label}</span>
          </div>
          <div className={gridClass}>
            {section.items.map((asset, assetIndex) => (
              <a key={`${asset.url}-${assetIndex}`} href={asset.url} target="_blank" rel="noopener noreferrer" className={`group block shrink-0 overflow-hidden rounded-md border border-gray-200 bg-gray-50 ${tileSize}`}>
                {isImageAsset(asset) ? (
                  <img src={asset.url} alt={asset.caption || section.label} className="h-full w-full object-contain" onError={(e) => { e.currentTarget.src = '/placeholder.svg'; }} />
                ) : (
                  <span className="flex h-full w-full flex-col items-center justify-center gap-1 px-1 text-center text-[10px] font-semibold text-gray-500">
                    <FiFile size={16} />
                    <span className="line-clamp-2">{asset.name || 'File'}</span>
                  </span>
                )}
              </a>
            ))}
          </div>
          {section.items.length > 0 && (
            <p className="mt-1 break-words text-[11px] text-gray-500">
              {section.items.map((asset) => asset.caption || asset.name).filter(Boolean).join(', ')}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
