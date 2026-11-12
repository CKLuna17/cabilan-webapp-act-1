import React, { useState } from 'react';
import { 
  Shield, 
  UploadCloud, 
  FileText, 
  CheckCircle2, 
  Download, 
  Trash2, 
  ArrowLeft, 
  Lock, 
  ShieldCheck 
} from 'lucide-react';
import { StoredFileRecord, formatFileSize, downloadFileRecord } from '../lib/storage';
import { FileUploadArea } from './FileUploadArea';

interface ClientPortalViewProps {
  clientName: string;
  files: StoredFileRecord[];
  onUploadComplete: () => void;
  onDeleteFile: (file: StoredFileRecord) => void;
  onBackToDashboard: () => void;
}

export const ClientPortalView: React.FC<ClientPortalViewProps> = ({
  clientName,
  files,
  onUploadComplete,
  onDeleteFile,
  onBackToDashboard
}) => {
  const clientFiles = files.filter((f) => f.clientName === clientName);

  return (
    <div 
      className="min-h-screen bg-cover bg-center bg-no-repeat flex flex-col relative"
      style={{ backgroundImage: `url('/assets/aistudio/image_2e397125.png')` }}
    >
      {/* Subtle overlay for contrast */}
      <div className="absolute inset-0 bg-slate-900/10 backdrop-blur-[1px] pointer-events-none" />

      {/* Frosted Top Navigation Bar */}
      <header className="bg-slate-950/60 backdrop-blur-2xl text-white px-6 py-4 border-b border-white/15 flex items-center justify-between sticky top-0 z-20 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/30 backdrop-blur-md flex items-center justify-center shadow-lg shadow-blue-900/30">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm tracking-tight text-white drop-shadow-2xs">ClientVault</span>
              <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full border border-white/30 font-semibold uppercase backdrop-blur-xs">
                Client Upload Space
              </span>
            </div>
            <p className="text-[11px] text-white/70 font-medium">Secured with 256-bit encryption</p>
          </div>
        </div>

        <button
          onClick={onBackToDashboard}
          className="px-3.5 py-1.5 text-xs font-semibold text-white bg-white/15 hover:bg-white/25 border border-white/30 rounded-xl transition flex items-center gap-1.5 cursor-pointer backdrop-blur-md shadow-xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Exit to Main Dashboard</span>
        </button>
      </header>

      {/* Main Content Area */}
      <main className="max-w-4xl w-full mx-auto p-6 md:p-10 flex-1 relative z-10">
        {/* Frosted Client Welcome Banner */}
        <div className="bg-white/50 backdrop-blur-2xl rounded-3xl border border-white/60 p-6 md:p-8 mb-8 shadow-xl shadow-blue-950/5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold text-blue-700 uppercase tracking-wider bg-white/70 border border-white/80 px-2.5 py-1 rounded-lg shadow-2xs">
                Client Portal
              </span>
              <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 mt-2.5 drop-shadow-2xs">
                {clientName}
              </h1>
              <p className="text-xs md:text-sm text-slate-700 mt-1 max-w-xl font-medium">
                Please upload any required brand assets, project briefs, reference images, or contracts below. All uploads are immediately delivered to your project team.
              </p>
            </div>
            <div className="flex items-center gap-3 p-3.5 bg-white/60 backdrop-blur-md rounded-2xl border border-white/70 text-xs text-slate-700 shadow-2xs">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <p className="font-bold text-slate-900">Secure Direct Delivery</p>
                <p className="text-[11px] text-slate-600 font-medium">Only authorized team members can access</p>
              </div>
            </div>
          </div>
        </div>

        {/* Upload Component preset to this client */}
        <FileUploadArea
          availableClients={[clientName]}
          defaultClient={clientName}
          onUploadComplete={onUploadComplete}
        />

        {/* Frosted Uploaded Files Section */}
        <div className="bg-white/50 backdrop-blur-2xl rounded-3xl border border-white/60 p-6 shadow-xl shadow-blue-950/5">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/40">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                Uploaded Files ({clientFiles.length})
              </h3>
              <p className="text-xs text-slate-600 font-medium">Files available in this client space</p>
            </div>
          </div>

          {clientFiles.length === 0 ? (
            <div className="py-10 text-center text-slate-500 font-medium text-xs">
              No files have been uploaded to this space yet. Use the upload area above to upload assets.
            </div>
          ) : (
            <div className="divide-y divide-white/40">
              {clientFiles.map((file) => {
                const formattedDate = new Date(file.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                });

                return (
                  <div
                    key={file.id}
                    className="py-3 flex items-center justify-between text-xs hover:bg-slate-50/50 px-2 rounded-lg transition"
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-4">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 truncate">{file.name}</p>
                        <p className="text-[11px] text-slate-400">
                          {formatFileSize(file.size)} • Uploaded {formattedDate}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => downloadFileRecord(file)}
                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDeleteFile(file)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-6 text-xs text-slate-400 border-t border-slate-200 bg-white">
        Protected by ClientVault • Secure Client Collaboration Portal
      </footer>
    </div>
  );
};
