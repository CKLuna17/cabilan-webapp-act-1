import React, { useState } from 'react';
import { 
  Share2, 
  Copy, 
  Check, 
  ExternalLink, 
  Lock, 
  ShieldCheck, 
  X, 
  Send 
} from 'lucide-react';

interface SharePortalModalProps {
  onClose: () => void;
  clients: string[];
  onOpenClientUpload: (clientName: string) => void;
}

export const SharePortalModal: React.FC<SharePortalModalProps> = ({
  onClose,
  clients,
  onOpenClientUpload
}) => {
  const [selectedClient, setSelectedClient] = useState(clients[0] || 'General Vault');
  const [copied, setCopied] = useState(false);
  const [clientEmail, setClientEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);

  const portalLink = `${window.location.origin}?client=${encodeURIComponent(selectedClient)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(portalLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleSendInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientEmail.trim()) return;
    setEmailSent(true);
    setTimeout(() => {
      setEmailSent(false);
      setClientEmail('');
    }, 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white/80 backdrop-blur-3xl rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-white/80">
        <div className="flex items-center justify-between pb-4 border-b border-white/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-700 flex items-center justify-center border border-emerald-400/30">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Share Client Portal</h3>
              <p className="text-xs text-slate-600 font-medium">Allow clients to securely upload files directly</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Client Space:
            </label>
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
            >
              <option value="General Vault">General Vault</option>
              {clients
                .filter((c) => c !== 'General Vault')
                .map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Direct Upload Link:
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={portalLink}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-mono text-slate-600 focus:outline-none select-all"
              />
              <button
                type="button"
                onClick={handleCopy}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shrink-0 cursor-pointer shadow-sm shadow-blue-500/20"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              Clients can drag & drop design assets and documents directly into this space.
            </p>
          </div>

          {/* Quick email invite */}
          <div className="pt-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Email Link to Client:
            </label>
            <form onSubmit={handleSendInvite} className="flex gap-2">
              <input
                type="email"
                placeholder="client@company.com"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={!clientEmail.trim()}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition flex items-center gap-1.5 shrink-0 disabled:opacity-50 cursor-pointer"
              >
                {emailSent ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Send className="w-3.5 h-3.5" />}
                <span>{emailSent ? 'Invite Sent!' : 'Send'}</span>
              </button>
            </form>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                onOpenClientUpload(selectedClient);
                onClose();
              }}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1.5 hover:underline"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Preview Client Upload Experience</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
