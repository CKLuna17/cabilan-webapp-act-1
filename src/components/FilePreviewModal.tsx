import React, { useEffect, useState } from 'react';
import { 
  StoredFileRecord, 
  getFileFromIndexedDB, 
  downloadFileRecord, 
  formatFileSize 
} from '../lib/storage';
import { 
  X, 
  Download, 
  Trash2, 
  FileText, 
  Image as ImageIcon, 
  Layers, 
  Calendar, 
  HardDrive, 
  User, 
  ExternalLink 
} from 'lucide-react';

interface FilePreviewModalProps {
  file: StoredFileRecord | null;
  onClose: () => void;
  onDelete: (file: StoredFileRecord) => void;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  file,
  onClose,
  onDelete
}) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!file) {
      setBlobUrl(null);
      setTextContent(null);
      return;
    }

    let isCancelled = false;
    setLoading(true);

    const loadContent = async () => {
      let blob = await getFileFromIndexedDB(file.id);

      if (!blob && file.fileData) {
        try {
          const res = await fetch(file.fileData);
          blob = await res.blob();
        } catch {
          // ignore
        }
      }

      if (isCancelled) return;

      if (blob) {
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);

        // Check if text preview is appropriate
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (
          file.type.startsWith('text/') ||
          ['json', 'md', 'txt', 'csv', 'js', 'ts', 'html', 'css', 'xml'].includes(ext || '')
        ) {
          try {
            const text = await blob.text();
            setTextContent(text.slice(0, 50000)); // cap at 50k chars for performance
          } catch {
            // ignore
          }
        }
      }
      setLoading(false);
    };

    loadContent();

    return () => {
      isCancelled = true;
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [file]);

  if (!file) return null;

  const isImage =
    file.type.startsWith('image/') ||
    ['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif'].includes(
      file.name.split('.').pop()?.toLowerCase() || ''
    );

  const isPdf =
    file.type.includes('pdf') || file.name.toLowerCase().endsWith('.pdf');

  const formattedDate = new Date(file.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white/80 backdrop-blur-3xl rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-white/80 overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-white/40 flex items-center justify-between bg-white/40 backdrop-blur-md">
          <div className="flex items-center gap-3 min-w-0 pr-4">
            <div className="w-10 h-10 rounded-xl bg-white/80 text-blue-600 flex items-center justify-center shrink-0 border border-white/90 shadow-2xs">
              {isImage ? (
                <ImageIcon className="w-5 h-5" />
              ) : file.category === 'designs' ? (
                <Layers className="w-5 h-5" />
              ) : (
                <FileText className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-900 truncate">
                {file.name}
              </h3>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="font-medium text-blue-600">{file.clientName || 'General Vault'}</span>
                <span>•</span>
                <span>{formatFileSize(file.size)}</span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => downloadFileRecord(file)}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition flex items-center gap-1.5 shadow-sm shadow-blue-500/20 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download</span>
            </button>
            <button
              onClick={() => {
                onDelete(file);
                onClose();
              }}
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
              title="Delete File"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body / Preview Surface */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 flex items-center justify-center min-h-[350px]">
          {loading ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-slate-500">Loading file preview...</p>
            </div>
          ) : isImage && (blobUrl || file.fileData) ? (
            <div className="max-w-full max-h-[500px] flex items-center justify-center">
              <img
                src={blobUrl || file.fileData}
                alt={file.name}
                className="max-h-[500px] max-w-full object-contain rounded-lg shadow-sm border border-slate-200"
              />
            </div>
          ) : isPdf && blobUrl ? (
            <iframe
              src={blobUrl}
              title={file.name}
              className="w-full h-[520px] rounded-xl border border-slate-200 bg-white"
            />
          ) : textContent ? (
            <div className="w-full h-[450px] bg-slate-900 text-slate-100 p-4 rounded-xl font-mono text-xs overflow-auto border border-slate-800">
              <pre className="whitespace-pre-wrap">{textContent}</pre>
            </div>
          ) : (
            <div className="text-center p-8 bg-white rounded-2xl border border-slate-200 max-w-md shadow-sm">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
                {file.category === 'designs' ? (
                  <Layers className="w-8 h-8" />
                ) : (
                  <FileText className="w-8 h-8" />
                )}
              </div>
              <h4 className="text-base font-bold text-slate-800">{file.name}</h4>
              <p className="text-xs text-slate-500 mt-1 mb-5">
                Direct in-browser preview is not available for this format. You can download the pristine file directly to your system.
              </p>
              <button
                onClick={() => downloadFileRecord(file)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-2 shadow-sm transition"
              >
                <Download className="w-4 h-4" />
                Download {formatFileSize(file.size)}
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer / Metadata details */}
        <div className="px-6 py-3.5 bg-white border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-4">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-slate-400" />
              {formatFileSize(file.size)}
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              Uploaded {formattedDate}
            </span>
            <span className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              Client: {file.clientName || 'General'}
            </span>
          </div>
          <div className="text-[11px] text-slate-400">
            Secure client record ID: <span className="font-mono text-slate-500">{file.id}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
