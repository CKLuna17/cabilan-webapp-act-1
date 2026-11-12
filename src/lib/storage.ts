/**
 * ClientVault File Storage Service
 * Handles file reading, base64 encoding, IndexedDB binary storage, and downloading
 */

export interface StoredFileRecord {
  id: string;
  name: string;
  size: number;
  type: string;
  ownerId: string;
  category: 'documents' | 'designs' | 'images' | 'contracts' | 'other';
  clientName: string;
  fileData?: string; // Base64 data for files under 750KB for cloud persistence
  createdAt: string;
  updatedAt: string;
}

const DB_NAME = 'ClientVaultDB';
const DB_VERSION = 1;
const STORE_NAME = 'files';

function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveFileToIndexedDB(id: string, file: File | Blob): Promise<void> {
  try {
    const db = await openIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put({ id, blob: file, updatedAt: Date.now() });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to save in IndexedDB:', err);
  }
}

export async function getFileFromIndexedDB(id: string): Promise<Blob | null> {
  try {
    const db = await openIndexedDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => {
        if (req.result && req.result.blob) {
          resolve(req.result.blob);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function deleteFileFromIndexedDB(id: string): Promise<void> {
  try {
    const db = await openIndexedDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch {
    // ignore
  }
}

export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function getFileCategory(name: string, mimeType: string): 'documents' | 'designs' | 'images' | 'contracts' | 'other' {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif', 'bmp', 'ico'].includes(ext) || mimeType.startsWith('image/')) {
    return 'images';
  }
  if (['fig', 'sketch', 'psd', 'ai', 'xd', 'raw', 'blend', 'cdr'].includes(ext)) {
    return 'designs';
  }
  if (['pdf', 'doc', 'docx', 'txt', 'rtf', 'md', 'xlsx', 'xls', 'csv', 'pptx'].includes(ext) || mimeType.includes('pdf') || mimeType.includes('text')) {
    if (name.toLowerCase().includes('contract') || name.toLowerCase().includes('agreement') || name.toLowerCase().includes('nda') || name.toLowerCase().includes('terms')) {
      return 'contracts';
    }
    return 'documents';
  }
  return 'other';
}

export async function downloadFileRecord(fileRecord: StoredFileRecord): Promise<void> {
  let blob: Blob | null = null;

  // Try from IndexedDB first
  blob = await getFileFromIndexedDB(fileRecord.id);

  // If not in IndexedDB, reconstruct from base64
  if (!blob && fileRecord.fileData) {
    try {
      const res = await fetch(fileRecord.fileData);
      blob = await res.blob();
    } catch (e) {
      console.warn('Failed to fetch blob from data url:', e);
    }
  }

  if (!blob) {
    // If only metadata is known, create a representative placeholder file
    const placeholderContent = `ClientVault File: ${fileRecord.name}\nSize: ${formatFileSize(fileRecord.size)}\nUploaded: ${fileRecord.createdAt}\nClient: ${fileRecord.clientName || 'General'}`;
    blob = new Blob([placeholderContent], { type: fileRecord.type || 'text/plain' });
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileRecord.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
