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
            className="group relative aspect-4/3 rounded-xl overflow-hidden border border-white/80 bg-white/60 shadow-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
            title={`View ${photo.name}`}
          >
            <img
              src={photo.dataUrl}
              alt={photo.name}
              className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/25 transition flex items-center justify-center">
              <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition drop-shadow-sm" />
            </div>
          </button>
        ))}
      </div>

      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setLightboxPhoto(null)}
        >
          <div
            className="relative max-w-3xl w-full bg-white/85 backdrop-blur-2xl rounded-2xl border border-white p-3 sm:p-4 shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                  {lightboxPhoto.name}
                </p>
                <p className="text-[11px] font-mono tabular-nums text-slate-600">
                  Original size: {formatPhotoFileSize(lightboxPhoto.sizeBytes)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLightboxPhoto(null)}
                aria-label="Close image preview"
                className="p-2 text-slate-700 hover:text-slate-900 bg-white/80 hover:bg-white rounded-xl border border-white transition cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="rounded-xl overflow-hidden bg-slate-900/5 max-h-[75dvh] flex items-center justify-center">
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
