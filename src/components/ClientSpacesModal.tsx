import React, { useState } from 'react';
import { 
  Users, 
  Plus, 
  Copy, 
  Check, 
  Trash2, 
  FolderLock, 
  FileText, 
  ExternalLink, 
  X,
  Building
} from 'lucide-react';
import { StoredFileRecord, formatFileSize } from '../lib/storage';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';

export interface ClientSpaceRecord {
  id: string;
  name: string;
  email?: string;
  company?: string;
  ownerId: string;
  createdAt: string;
}

interface ClientSpacesModalProps {
  clients: ClientSpaceRecord[];
  files: StoredFileRecord[];
  onClose: () => void;
  onSelectClientFilter: (clientName: string) => void;
  onRefreshClients: () => void;
}

export const ClientSpacesModal: React.FC<ClientSpacesModalProps> = ({
  clients,
  files,
  onClose,
  onSelectClientFilter,
  onRefreshClients
}) => {
  const { user } = useAuth();
  const [newClientName, setNewClientName] = useState('');
  const [newClientCompany, setNewClientCompany] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newClientName.trim()) return;

    setCreating(true);
    const clientId = 'client_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

    const clientData: ClientSpaceRecord = {
      id: clientId,
      name: newClientName.trim(),
      company: newClientCompany.trim() || newClientName.trim(),
      email: newClientEmail.trim() || undefined,
      ownerId: user.uid,
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'clients', clientId), clientData);
      setNewClientName('');
      setNewClientCompany('');
      setNewClientEmail('');
      onRefreshClients();
    } catch (err) {
      console.error('Failed to create client space:', err);
      try {
        handleFirestoreError(err, OperationType.CREATE, `clients/${clientId}`);
      } catch {
        // ignore
      }
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteClient = async (client: ClientSpaceRecord) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'clients', client.id));
      onRefreshClients();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `clients/${client.id}`);
    }
  };

  const copyPortalLink = (clientName: string, id: string) => {
    const portalUrl = `${window.location.origin}?client=${encodeURIComponent(clientName)}`;
    navigator.clipboard.writeText(portalUrl).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2500);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white/75 backdrop-blur-3xl rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-white/80 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/50 flex items-center justify-between bg-white/40 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/80 text-blue-600 flex items-center justify-center border border-white/90 shadow-2xs">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Client Spaces</h3>
              <p className="text-xs text-slate-600 font-medium">Manage client portals and direct upload links</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-white/60 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Create Client Form */}
        <div className="p-6 border-b border-white/50 bg-white/35 backdrop-blur-md">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
            Add New Client Space
          </h4>
          <form onSubmit={handleCreateClient} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              required
              placeholder="Client Name *"
              value={newClientName}
              onChange={(e) => setNewClientName(e.target.value)}
              className="px-3 py-2 text-xs bg-white/70 backdrop-blur-md border border-white/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
            />
            <input
              type="text"
              placeholder="Company / Brand"
              value={newClientCompany}
              onChange={(e) => setNewClientCompany(e.target.value)}
              className="px-3 py-2 text-xs bg-white/70 backdrop-blur-md border border-white/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
            />
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="Client Email"
                value={newClientEmail}
                onChange={(e) => setNewClientEmail(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white/70 backdrop-blur-md border border-white/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
              />
              <button
                type="submit"
                disabled={creating || !newClientName.trim()}
                className="px-3.5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition flex items-center justify-center gap-1 shrink-0 disabled:opacity-50 cursor-pointer shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Add</span>
              </button>
            </div>
          </form>
        </div>

        {/* Existing Clients List */}
        <div className="flex-1 overflow-y-auto p-6 bg-white/20 backdrop-blur-md space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Your Client Portals ({clients.length + 1})</span>
          </div>

          {/* General Vault Item */}
          <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                <FolderLock className="w-5 h-5" />
              </div>
              <div>
                <h5 className="text-xs font-bold text-slate-800">General Vault</h5>
                <p className="text-[11px] text-slate-400">
                  {files.filter((f) => !f.clientName || f.clientName === 'General Vault').length} files • Default storage
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                onSelectClientFilter('General Vault');
                onClose();
              }}
              className="px-3 py-1.5 text-xs text-blue-600 font-medium hover:bg-blue-50 rounded-lg transition"
            >
              View Files
            </button>
          </div>

          {clients.map((client) => {
            const clientFiles = files.filter((f) => f.clientName === client.name);
            const totalSize = clientFiles.reduce((acc, f) => acc + f.size, 0);

            return (
              <div
                key={client.id}
                className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs uppercase">
                    {client.name.substring(0, 2)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h5 className="text-xs font-bold text-slate-900">{client.name}</h5>
                      {client.company && (
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                          {client.company}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {clientFiles.length} files • {formatFileSize(totalSize)}
                      {client.email && ` • ${client.email}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    onClick={() => copyPortalLink(client.name, client.id)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                    title="Copy direct client portal upload link"
                  >
                    {copiedId === client.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700 font-semibold">Copied Link</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-500" />
                        <span>Copy Link</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      onSelectClientFilter(client.name);
                      onClose();
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition cursor-pointer"
                  >
                    View Files
                  </button>
                  <button
                    onClick={() => handleDeleteClient(client)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                    title="Delete Client Space"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
