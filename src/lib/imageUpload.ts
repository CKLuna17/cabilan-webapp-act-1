export const MIN_ANNOUNCEMENT_IMAGE_BYTES = 500 * 1000; // 500 KB minimum
export const MAX_ANNOUNCEMENT_IMAGE_BYTES = 3 * 1024 * 1024; // 3 MB maximum
export const MAX_ANNOUNCEMENT_PHOTOS = 4;
const MAX_FIRESTORE_DATA_URL_LENGTH = 500000; // Safely within 550,000 char rule limit

export interface PendingAnnouncementPhoto {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  previewUrl: string;
  dataUrl: string | null;
  error: string | null;
  isObjectUrl: boolean;
}

export function formatPhotoFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    const mb =
      bytes > MAX_ANNOUNCEMENT_IMAGE_BYTES
        ? Math.ceil((bytes / (1024 * 1024)) * 100) / 100
        : bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  }
  return `${Math.floor(bytes / 1000)} KB`;
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Unable to decode image file'));
    img.src = src;
  });
}

async function compressImageToDataUrl(objectUrl: string): Promise<string> {
  const img = await loadImageElement(objectUrl);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Image processing context unavailable');
  }

  const dimensionCaps = [1400, 1100, 860, 640];
  const qualities = [0.84, 0.72, 0.58, 0.45];

  for (const maxDim of dimensionCaps) {
    const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
    canvas.width = Math.max(1, Math.round((img.width || 1) * scale));
    canvas.height = Math.max(1, Math.round((img.height || 1) * scale));

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    for (const quality of qualities) {
      const candidate = canvas.toDataURL('image/jpeg', quality);
      if (candidate.length <= MAX_FIRESTORE_DATA_URL_LENGTH) {
        return candidate;
      }
    }
  }

  const fallback = canvas.toDataURL('image/jpeg', 0.35);
  if (fallback.length <= MAX_FIRESTORE_DATA_URL_LENGTH) {
    return fallback;
  }
  throw new Error('Image dimensions could not be prepared for upload');
}

export async function processAnnouncementImageFile(
  file: File,
  indexOffset: number
): Promise<PendingAnnouncementPhoto> {
  const id = `photo_${Date.now()}_${indexOffset}_${Math.random().toString(36).slice(2, 7)}`;
  const isImage = file.type.startsWith('image/');

  if (!isImage) {
    return {
      id,
      name: file.name,
      mimeType: file.type || 'unknown',
      sizeBytes: file.size,
      previewUrl: '',
      dataUrl: null,
      error: 'Images only — non-image files are not allowed.',
      isObjectUrl: false,
    };
  }

  const previewUrl = URL.createObjectURL(file);

  if (file.size < MIN_ANNOUNCEMENT_IMAGE_BYTES) {
    return {
      id,
      name: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      previewUrl,
      dataUrl: null,
      error: `Below 500 KB minimum (${formatPhotoFileSize(file.size)}).`,
      isObjectUrl: true,
    };
  }

  if (file.size > MAX_ANNOUNCEMENT_IMAGE_BYTES) {
    return {
      id,
      name: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      previewUrl,
      dataUrl: null,
      error: `Exceeds 3 MB maximum (${formatPhotoFileSize(file.size)}).`,
      isObjectUrl: true,
    };
  }

  try {
    const dataUrl = await compressImageToDataUrl(previewUrl);
    return {
      id,
      name: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      previewUrl,
      dataUrl,
      error: null,
      isObjectUrl: true,
    };
  } catch {
    return {
      id,
      name: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      previewUrl,
      dataUrl: null,
      error: 'Could not read image data. Please choose another picture.',
      isObjectUrl: true,
    };
  }
}

export function revokePendingPhotoPreview(photo: PendingAnnouncementPhoto): void {
  if (photo.isObjectUrl && photo.previewUrl) {
    URL.revokeObjectURL(photo.previewUrl);
  }
}

export async function compressIdPortraitToDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file for your ID portrait.');
  }
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImageElement(objectUrl);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Image processing unavailable');
    }

    const size = 360;
    canvas.width = size;
    canvas.height = size;
    const minSide = Math.min(img.width || 1, img.height || 1);
    const sx = Math.max(0, ((img.width || 1) - minSide) / 2);
    const sy = Math.max(0, ((img.height || 1) - minSide) / 2);
    ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);

    for (const quality of [0.82, 0.68, 0.52]) {
      const candidate = canvas.toDataURL('image/jpeg', quality);
      if (candidate.length <= 140000) {
        return candidate;
      }
    }
    return canvas.toDataURL('image/jpeg', 0.4);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
