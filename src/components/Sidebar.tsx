import React from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Shield, 
  Files, 
  UploadCloud, 
  Users, 
  Share2, 
  LogOut, 
  HardDrive,
  ExternalLink,
  ChevronRight
} from 'lucide-react';

interface SidebarProps {
  currentTab: 'files' | 'upload' | 'clients' | 'share';
  setCurrentTab: (tab: 'files' | 'upload' | 'clients' | 'share') => void;
  totalFilesCount: number;
  totalStorageBytes: number;
  openShareModal: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  totalFilesCount,
  totalStorageBytes,
  openShareModal
}) => {
  const { user, userProfile, signOutUser } = useAuth();

  // 100 MB free tier storage limit representation
  const maxStorageBytes = 100 * 1024 * 1024;
  const storagePercentage = Math.min(100, Math.round((totalStorageBytes / maxStorageBytes) * 100));

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 MB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  interface NavItem {
    id: 'files' | 'upload' | 'clients';
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }

  const navItems: NavItem[] = [
    { id: 'files', label: 'All Files', icon: Files, badge: totalFilesCount },
    { id: 'upload', label: 'Upload Files', icon: UploadCloud },
    { id: 'clients', label: 'Client Spaces', icon: Users },
  ];

  return (
    <aside className="w-64 bg-slate-950/50 backdrop-blur-3xl text-slate-200 flex flex-col justify-between shrink-0 h-screen sticky top-0 border-r border-white/15 z-20 select-none shadow-2xl">
      <div>
        {/* Brand Header */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/30 backdrop-blur-md flex items-center justify-center shadow-lg shadow-blue-900/30">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-xl font-extrabold tracking-tight text-white flex items-center gap-2 drop-shadow-2xs">
                ClientVault
              </div>
              <p className="text-[11px] text-white/70 font-medium">Client File Portal</p>
            </div>
          </div>
        </div>

        {/* Primary Navigation */}
        <nav className="p-4 space-y-1.5">
          <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-white/50">
            Workspace
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer backdrop-blur-xs ${
                  isActive
                    ? 'bg-blue-600/85 text-white shadow-lg shadow-blue-600/30 border border-white/25 font-semibold'
                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-white/70'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                      isActive ? 'bg-blue-700/80 text-white' : 'bg-white/15 text-white/80 border border-white/10'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          {/* Quick Client Portal Share Button */}
          <div className="pt-4">
            <button
              onClick={openShareModal}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium text-emerald-200 bg-emerald-500/20 backdrop-blur-md border border-emerald-400/30 hover:bg-emerald-500/30 transition cursor-pointer shadow-xs"
            >
              <div className="flex items-center gap-3">
                <Share2 className="w-4 h-4 text-emerald-300" />
                <span>Share Client Link</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-emerald-300" />
            </button>
          </div>
        </nav>
      </div>

      {/* Bottom Section: Storage & User Info */}
      <div className="p-4 space-y-4 border-t border-white/10">
        {/* Storage Usage Widget */}
        <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/15 shadow-xs">
          <div className="flex items-center justify-between text-xs text-white/80 mb-1.5">
            <span className="flex items-center gap-1.5 font-medium text-white">
              <HardDrive className="w-3.5 h-3.5 text-blue-300" />
              Storage Used
            </span>
            <span className="font-semibold text-white">
              {formatSize(totalStorageBytes)}
            </span>
          </div>
          <div className="w-full bg-white/15 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-400 to-indigo-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.max(5, storagePercentage)}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-[10px] text-white/60 mt-1">
            <span>{totalFilesCount} files stored</span>
            <span>100 MB free plan</span>
          </div>
        </div>

        {/* User Profile Bar */}
        <div className="pt-2 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500 text-white font-semibold flex items-center justify-center shrink-0 text-xs shadow-inner uppercase border border-white/30">
              {(userProfile?.displayName || user?.email || 'U')[0]}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">
                {userProfile?.displayName || 'Vault Member'}
              </p>
              <p className="text-[11px] text-white/70 truncate">
                {user?.email || 'Authenticated User'}
              </p>
            </div>
          </div>
          <button
            onClick={() => signOutUser()}
            title="Sign Out"
            className="p-2 text-white/70 hover:text-rose-300 hover:bg-white/10 rounded-xl transition shrink-0 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
