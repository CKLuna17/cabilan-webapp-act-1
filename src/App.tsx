/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthPage } from './components/AuthPage';
import { Sidebar } from './components/Sidebar';
import { FileUploadArea } from './components/FileUploadArea';
import { FileList } from './components/FileList';
import { FilePreviewModal } from './components/FilePreviewModal';
import { ClientSpacesModal, ClientSpaceRecord } from './components/ClientSpacesModal';
import { SharePortalModal } from './components/SharePortalModal';
import { ClientPortalView } from './components/ClientPortalView';
import { StoredFileRecord, deleteFileFromIndexedDB, formatFileSize } from './lib/storage';
import { db, handleFirestoreError, OperationType } from './lib/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  deleteDoc, 
  getDocs,
  setDoc
} from 'firebase/firestore';
import { 
  Shield, 
  UploadCloud, 
  FolderLock, 
  HardDrive, 
  Users, 
  Share2, 
  Sparkles, 
  CheckCircle2,
  FileCheck,
  Plus
} from 'lucide-react';

function Dashboard() {
  const { user, userProfile } = useAuth();
  const [files, setFiles] = useState<StoredFileRecord[]>([]);
  const [clients, setClients] = useState<ClientSpaceRecord[]>([]);
  const [currentTab, setCurrentTab] = useState<'files' | 'upload' | 'clients' | 'share'>('files');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedClientFilter, setSelectedClientFilter] = useState<string>('all');
  const [previewingFile, setPreviewingFile] = useState<StoredFileRecord | null>(null);
  const [showClientsModal, setShowClientsModal] = useState<boolean>(false);
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [activeClientPortal, setActiveClientPortal] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Check URL query parameters on initial load for ?client=...
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const clientParam = params.get('client');
    if (clientParam) {
      setActiveClientPortal(clientParam);
    }
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Firestore Real-time Listener for Files
  useEffect(() => {
    if (!user) {
      setFiles([]);
      return;
    }

    const filesQuery = query(
      collection(db, 'files'),
      where('ownerId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      filesQuery,
      (snapshot) => {
        const fileList: StoredFileRecord[] = [];
        snapshot.forEach((docSnap) => {
          fileList.push(docSnap.data() as StoredFileRecord);
        });
        setFiles(fileList);
      },
      (error) => {
        console.error('Files listener error:', error);
        handleFirestoreError(error, OperationType.GET, 'files');
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Firestore Real-time Listener for Client Spaces
  useEffect(() => {
    if (!user) {
      setClients([]);
      return;
    }

    const clientsQuery = query(
      collection(db, 'clients'),
      where('ownerId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      clientsQuery,
      (snapshot) => {
        const clientList: ClientSpaceRecord[] = [];
        snapshot.forEach((docSnap) => {
          clientList.push(docSnap.data() as ClientSpaceRecord);
        });
        setClients(clientList);
      },
      (error) => {
        console.error('Clients listener error:', error);
        handleFirestoreError(error, OperationType.GET, 'clients');
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Delete File Handler
  const handleDeleteFile = async (file: StoredFileRecord) => {
    if (!user) return;
    try {
      // Delete from Firestore
      await deleteDoc(doc(db, 'files', file.id));
      // Delete from IndexedDB binary cache
      await deleteFileFromIndexedDB(file.id);
      showToast(`Deleted "${file.name}"`);
    } catch (err) {
      console.error('Delete error:', err);
      handleFirestoreError(err, OperationType.DELETE, `files/${file.id}`);
    }
  };

  // Calculated metrics
  const totalStorageBytes = files.reduce((acc, f) => acc + (f.size || 0), 0);
  
  // Unique client names
  const availableClients = Array.from(
    new Set([
      'General Vault',
      ...clients.map((c) => c.name),
      ...files.map((f) => f.clientName).filter(Boolean)
    ])
  );

  // If in client portal direct view
  if (activeClientPortal) {
    return (
      <ClientPortalView
        clientName={activeClientPortal}
        files={files}
        onUploadComplete={() => showToast('File uploaded successfully')}
        onDeleteFile={handleDeleteFile}
        onBackToDashboard={() => {
          setActiveClientPortal(null);
          // Clean URL parameter without reloading
          const url = new URL(window.location.href);
          url.searchParams.delete('client');
          window.history.pushState({}, '', url.pathname);
        }}
      />
    );
  }

  return (
    <div 
      className="flex h-screen overflow-hidden font-sans bg-cover bg-center bg-no-repeat relative"
      style={{ backgroundImage: `url('/assets/aistudio/image_2e397125.png')` }}
    >
      {/* Subtle overlay for depth and high contrast readability */}
      <div className="absolute inset-0 bg-slate-900/10 backdrop-blur-[1px] pointer-events-none" />

      {/* Frosted Glass Sidebar */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={(tab) => {
          setCurrentTab(tab);
          if (tab === 'clients') {
            setShowClientsModal(true);
          }
        }}
        totalFilesCount={files.length}
        totalStorageBytes={totalStorageBytes}
        openShareModal={() => setShowShareModal(true)}
      />

      {/* Main Content Area: Frosted Glass UI over Celestial Wallpaper */}
      <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-transparent relative z-10">
        {/* Frosted Top Navbar */}
        <header className="sticky top-0 z-10 bg-white/40 backdrop-blur-2xl border-b border-white/40 px-6 py-4 flex items-center justify-between shadow-xs">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight drop-shadow-2xs">
              {currentTab === 'upload' ? 'Upload Files' : 'Files & Portal Dashboard'}
            </h1>
            <p className="text-xs text-slate-700 mt-0.5 font-medium">
              Welcome back, <span className="font-bold text-slate-900">{userProfile?.displayName || user?.email?.split('@')[0]}</span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowShareModal(true)}
              className="px-3.5 py-2 text-xs font-semibold text-slate-800 bg-white/60 hover:bg-white/80 border border-white/70 backdrop-blur-md rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5 text-slate-700" />
              <span>Share Portal</span>
            </button>
            <button
              onClick={() => setCurrentTab('upload')}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition flex items-center gap-1.5 shadow-md shadow-blue-600/30 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Upload Files</span>
            </button>
          </div>
        </header>

        {/* Dashboard Body */}
        <main className="p-6 max-w-7xl w-full mx-auto space-y-6 flex-1">
          {/* Frosted Quick Metrics Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white/50 backdrop-blur-2xl p-4 rounded-2xl border border-white/60 shadow-lg shadow-blue-950/5 flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-blue-50/80 backdrop-blur-xs text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
                <FolderLock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-600">Total Uploaded Files</p>
                <p className="text-xl font-extrabold text-slate-900">{files.length}</p>
              </div>
            </div>

            <div className="bg-white/50 backdrop-blur-2xl p-4 rounded-2xl border border-white/60 shadow-lg shadow-blue-950/5 flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-purple-50/80 backdrop-blur-xs text-purple-600 border border-purple-100 flex items-center justify-center shrink-0">
                <HardDrive className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-600">Storage Used</p>
                <p className="text-xl font-extrabold text-slate-900">{formatFileSize(totalStorageBytes)}</p>
              </div>
            </div>

            <div className="bg-white/50 backdrop-blur-2xl p-4 rounded-2xl border border-white/60 shadow-lg shadow-blue-950/5 flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50/80 backdrop-blur-xs text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-600">Active Client Spaces</p>
                  <p className="text-xl font-extrabold text-slate-900">{availableClients.length}</p>
                </div>
              </div>
              <button
                onClick={() => setShowClientsModal(true)}
                className="text-xs text-blue-700 font-bold hover:underline bg-white/60 px-2.5 py-1 rounded-lg border border-white/60"
              >
                Manage
              </button>
            </div>
          </div>

          {/* Upload Area (Featured on 'upload' tab or accessible on 'files' tab) */}
          {(currentTab === 'upload' || files.length === 0) && (
            <FileUploadArea
              availableClients={availableClients}
              defaultClient={selectedClientFilter !== 'all' ? selectedClientFilter : 'General Vault'}
              onUploadComplete={() => {
                showToast('Files uploaded successfully');
                setCurrentTab('files');
              }}
            />
          )}

          {/* Files List Table and Cards */}
          <div>
            <div className="flex items-center justify-between mb-3 px-1">
              <h2 className="text-base font-bold text-slate-900">
                All Files {selectedClientFilter !== 'all' && `(${selectedClientFilter})`}
              </h2>
              {files.length > 0 && currentTab !== 'upload' && (
                <button
                  onClick={() => setCurrentTab('upload')}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Upload More</span>
                </button>
              )}
            </div>

            <FileList
              files={files}
              onDeleteFile={handleDeleteFile}
              onPreviewFile={(file) => setPreviewingFile(file)}
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
              selectedClientFilter={selectedClientFilter}
              setSelectedClientFilter={setSelectedClientFilter}
              availableClients={availableClients}
            />
          </div>
        </main>
      </div>

      {/* File Preview Modal */}
      <FilePreviewModal
        file={previewingFile}
        onClose={() => setPreviewingFile(null)}
        onDelete={handleDeleteFile}
      />

      {/* Client Spaces Modal */}
      {showClientsModal && (
        <ClientSpacesModal
          clients={clients}
          files={files}
          onClose={() => setShowClientsModal(false)}
          onSelectClientFilter={(clientName) => {
            setSelectedClientFilter(clientName);
            setCurrentTab('files');
          }}
          onRefreshClients={() => {}}
        />
      )}

      {/* Share Portal Modal */}
      {showShareModal && (
        <SharePortalModal
          clients={availableClients}
          onClose={() => setShowShareModal(false)}
          onOpenClientUpload={(clientName) => {
            setActiveClientPortal(clientName);
          }}
        />
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 text-xs font-medium animate-in slide-in-from-bottom duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B132B] flex flex-col items-center justify-center text-white">
        <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center mb-4 shadow-lg shadow-blue-500/30 animate-pulse">
          <Shield className="w-6 h-6 text-white" />
        </div>
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs text-slate-400 font-medium tracking-wide">
          Connecting to ClientVault...
        </p>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return <Dashboard />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
