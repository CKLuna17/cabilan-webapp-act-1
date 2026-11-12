import React, { useState, useRef } from 'react';
import { 
  UploadCloud, 
  FileText, 
  Image as ImageIcon, 
  Layers, 
  FileCheck, 
  AlertCircle, 
  CheckCircle2, 
  X, 
  Plus, 
  FolderPlus 
} from 'lucide-react';
import { 
  StoredFileRecord, 
  readFileAsBase64, 
  saveFileToIndexedDB, 
  getFileCategory, 
  formatFileSize 
} from '../lib/storage';
import { collection, doc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';

interface FileUploadAreaProps {
  onUploadComplete?: () => void;
  availableClients: string[];
  defaultClient?: string;
}

interface UploadTask {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  errorMessage?: string;
  category: 'documents' | 'designs' | 'images' | 'contracts' | 'other';
  clientName: string;
}

export const FileUploadArea: React.FC<FileUploadAreaProps> = ({
  onUploadComplete,
  availableClients,
  defaultClient
}) => {
  const { user } = useAuth();
  const [isDragging, setIsDragging] = useState(false);
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>(defaultClient || 'General Vault');
  const [customClientInput, setCustomClientInput] = useState('');
  const [showNewClientInput, setShowNewClientInput] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFilesToQueue(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFilesToQueue(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const addFilesToQueue = (files: File[]) => {
    const client = showNewClientInput && customClientInput.trim() 
      ? customClientInput.trim() 
      : selectedClient;

    const newTasks: UploadTask[] = files.map((file) => ({
      file,
      progress: 0,
      status: 'pending',
      category: getFileCategory(file.name, file.type),
      clientName: client || 'General Vault'
    }));

    setUploadTasks((prev) => [...prev, ...newTasks]);
    processUploadQueue(newTasks);
  };

  const processUploadQueue = async (tasksToRun: UploadTask[]) => {
    if (!user) return;
    setIsProcessing(true);

    for (const task of tasksToRun) {
      // Generate clean valid document ID
      const safeId = 'file_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
      
      try {
        // Update to uploading
        setUploadTasks((prev) =>
          prev.map((t) => (t.file === task.file ? { ...t, status: 'uploading', progress: 30 } : t))
        );

        // Save binary file into browser IndexedDB
        await saveFileToIndexedDB(safeId, task.file);

        // For files under 750KB, also convert to base64 for direct cloud sync
        let base64Data: string | undefined = undefined;
        if (task.file.size <= 750000) {
          try {
            base64Data = await readFileAsBase64(task.file);
          } catch {
            // ignore if base64 conversion failed
          }
        }

        setUploadTasks((prev) =>
          prev.map((t) => (t.file === task.file ? { ...t, progress: 75 } : t))
        );

        const fileRecord: StoredFileRecord = {
          id: safeId,
          name: task.file.name,
          size: task.file.size,
          type: task.file.type || 'application/octet-stream',
          ownerId: user.uid,
          category: task.category,
          clientName: task.clientName,
          fileData: base64Data,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        // Write file record into Firestore
        await setDoc(doc(db, 'files', safeId), fileRecord);

        // Mark completed
        setUploadTasks((prev) =>
          prev.map((t) => (t.file === task.file ? { ...t, status: 'completed', progress: 100 } : t))
        );

        if (onUploadComplete) {
          onUploadComplete();
        }
      } catch (err: any) {
        console.error('File Upload Error:', err);
        setUploadTasks((prev) =>
          prev.map((t) =>
            t.file === task.file
              ? { ...t, status: 'error', errorMessage: err.message || 'Upload failed' }
              : t
          )
        );
        try {
          handleFirestoreError(err, OperationType.CREATE, `files/${safeId}`);
        } catch {
          // Keep loop running
        }
      }
    }

    setIsProcessing(false);
  };

  const removeTask = (file: File) => {
    setUploadTasks((prev) => prev.filter((t) => t.file !== file));
  };

  const clearCompleted = () => {
    setUploadTasks((prev) => prev.filter((t) => t.status !== 'completed'));
  };

  return (
    <div className="bg-white/50 backdrop-blur-2xl rounded-2xl border border-white/60 shadow-xl shadow-blue-950/10 p-6 mb-8">
      {/* Upload Header & Client Space Tagging */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-5 border-b border-white/50">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2 drop-shadow-2xs">
            <UploadCloud className="w-5 h-5 text-blue-600" />
            Upload Files
          </h2>
          <p className="text-xs text-slate-600 mt-0.5 font-medium">
            Add files to your personal vault or associate them with a client project
          </p>
        </div>

        {/* Client Tagging Selector */}
        <div className="flex items-center gap-2">
          {!showNewClientInput ? (
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-700">Client / Project:</label>
              <select
                value={selectedClient}
                onChange={(e) => setSelectedClient(e.target.value)}
                className="text-xs font-medium bg-white/70 backdrop-blur-md border border-white/80 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 shadow-xs"
              >
                <option value="General Vault">General Vault</option>
                {availableClients
                  .filter((c) => c !== 'General Vault')
                  .map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                onClick={() => setShowNewClientInput(true)}
                title="Add new client or project tag"
                className="p-1.5 text-xs text-blue-700 bg-white/60 hover:bg-white/90 border border-white/70 rounded-xl font-semibold flex items-center gap-1 transition shadow-xs cursor-pointer backdrop-blur-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">New Client</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Enter client name..."
                value={customClientInput}
                onChange={(e) => setCustomClientInput(e.target.value)}
                className="text-xs bg-white/70 backdrop-blur-md border border-white/80 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 shadow-xs"
                autoFocus
              />
              <button
                type="button"
                onClick={() => {
                  if (customClientInput.trim()) {
                    setSelectedClient(customClientInput.trim());
                  }
                  setShowNewClientInput(false);
                }}
                className="px-2.5 py-1.5 text-xs bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition shadow-xs cursor-pointer"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setShowNewClientInput(false)}
                className="p-1.5 text-xs text-slate-500 hover:text-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Frosted Drag & Drop Box */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center cursor-pointer transition-all duration-200 backdrop-blur-md ${
          isDragging
            ? 'border-blue-500 bg-white/80 scale-[0.99] shadow-lg shadow-blue-500/10'
            : 'border-white/80 hover:border-blue-400/80 hover:bg-white/65 bg-white/35 shadow-xs'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />

        <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 mb-3.5 ring-4 ring-blue-50/50">
          <UploadCloud className="w-7 h-7" />
        </div>

        <h3 className="text-sm sm:text-base font-semibold text-slate-800">
          Drag and drop files here, or <span className="text-blue-600 underline">browse</span>
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          Supports design assets (PSD, Figma, AI), PDFs, images, docs & contracts up to 50MB
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-[11px] text-slate-500">
          <span className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md">
            <FileText className="w-3 h-3 text-slate-400" /> Documents & PDFs
          </span>
          <span className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md">
            <Layers className="w-3 h-3 text-slate-400" /> Figma / PSD / AI
          </span>
          <span className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md">
            <ImageIcon className="w-3 h-3 text-slate-400" /> High-res Imagery
          </span>
        </div>
      </div>

      {/* Upload Tasks / Queue list */}
      {uploadTasks.length > 0 && (
        <div className="mt-5 space-y-2.5">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold px-1">
            <span>Upload Queue ({uploadTasks.length})</span>
            {uploadTasks.some((t) => t.status === 'completed') && (
              <button
                type="button"
                onClick={clearCompleted}
                className="text-blue-600 hover:underline font-medium"
              >
                Clear finished
              </button>
            )}
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {uploadTasks.map((task, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs"
              >
                <div className="flex items-center gap-3 min-w-0 pr-3">
                  <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
                    {task.status === 'completed' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : task.status === 'error' ? (
                      <AlertCircle className="w-4 h-4 text-rose-500" />
                    ) : (
                      <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 truncate">{task.file.name}</p>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <span>{formatFileSize(task.file.size)}</span>
                      <span>•</span>
                      <span className="text-blue-600 font-medium">{task.clientName}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="w-20 bg-slate-200 h-1.5 rounded-full overflow-hidden hidden sm:block">
                    <div
                      className={`h-full transition-all ${
                        task.status === 'completed'
                          ? 'bg-emerald-500'
                          : task.status === 'error'
                          ? 'bg-rose-500'
                          : 'bg-blue-600'
                      }`}
                      style={{ width: `${task.progress}%` }}
                    />
                  </div>
                  <button
                    onClick={() => removeTask(task.file)}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
