import React, { useState } from 'react';
import { X, ZoomIn } from 'lucide-react';
import { AnnouncementPhotoRecord } from '../types/attendly';
import { formatPhotoFileSize } from '../lib/imageUpload';

interface AnnouncementPhotoGalleryProps {
  photos: AnnouncementPhotoRecord[];
}

export const AnnouncementPhotoGallery: React.FC<AnnouncementPhotoGalleryProps> = ({ photos }) => {
  const [lightboxPhoto, setLightboxPhoto] = useState<AnnouncementPhotoRecord | null>(null);

  if (photos.length === 0) return null;

  const sortedPhotos = [...photos].sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <>
      <div
        className={`pt-2 grid gap-2 ${
          sortedPhotos.length === 1
            ? 'grid-cols-1 max-w-xs'
            : sortedPhotos.length === 2
            ? 'grid-cols-2 max-w-md'
            : 'grid-cols-2 sm:grid-cols-4'
        }`}
      >
        {sortedPhotos.map((photo) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => setLightboxPhoto(photo)}
            className="group relative aspect-4/3 rounded-xl overflow-hidden border border-[#E7E3FA] dark:border-[#2C2654] bg-[#F5F3FE] dark:bg-[#241F4A] shadow-2xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#6B5BF7]"
            title={`View ${photo.name}`}
          >
            <img
              src={photo.dataUrl}
              alt={photo.name}
              className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-[#110E26]/0 group-hover:bg-[#110E26]/30 transition flex items-center justify-center">
              <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition drop-shadow-sm" />
            </div>
          </button>
        ))}
      </div>

      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-[60] bg-[#0E0B20]/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setLightboxPhoto(null)}
        >
          <div
            className="relative max-w-3xl w-full bg-white dark:bg-[#1B1738] rounded-3xl border border-[#E7E3FA] dark:border-[#2C2654] p-3 sm:p-4 shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                  {lightboxPhoto.name}
                </p>
                <p className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-[#A6A0CE]">
                  Original size: {formatPhotoFileSize(lightboxPhoto.sizeBytes)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLightboxPhoto(null)}
                aria-label="Close image preview"
                className="p-2 text-slate-600 dark:text-[#A6A0CE] hover:text-slate-900 dark:hover:text-white bg-[#F5F3FE] dark:bg-[#241F4A] rounded-xl border border-[#E7E3FA] dark:border-[#322B61] transition cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="rounded-2xl overflow-hidden bg-[#F5F3FE] dark:bg-[#110E26] max-h-[75dvh] flex items-center justify-center">
              <img
                src={lightboxPhoto.dataUrl}
                alt={lightboxPhoto.name}
                className="max-h-[75dvh] w-auto max-w-full object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
