import React, { useState } from 'react';
import { StoredFileRecord, formatFileSize, downloadFileRecord } from '../lib/storage';
import { 
  FileText, 
  Image as ImageIcon, 
  Layers, 
  Download, 
  Trash2, 
  Eye, 
  Search, 
  Filter, 
  ArrowUpDown, 
  LayoutGrid, 
  List as ListIcon, 
  Calendar, 
  HardDrive, 
  AlertTriangle,
  FolderOpen,
  Share2,
  Check
} from 'lucide-react';

interface FileListProps {
  files: StoredFileRecord[];
  onDeleteFile: (file: StoredFileRecord) => void;
  onPreviewFile: (file: StoredFileRecord) => void;
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  selectedClientFilter: string;
  setSelectedClientFilter: (client: string) => void;
  availableClients: string[];
}

export const FileList: React.FC<FileListProps> = ({
  files,
  onDeleteFile,
  onPreviewFile,
  selectedCategory,
  setSelectedCategory,
  selectedClientFilter,
  setSelectedClientFilter,
  availableClients
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'name-asc' | 'size-desc'>('date-desc');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [fileToDelete, setFileToDelete] = useState<StoredFileRecord | null>(null);
  const [copiedFileId, setCopiedFileId] = useState<string | null>(null);

  // Filter files
  const filteredFiles = files.filter((f) => {
    const matchesSearch =
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (f.clientName && f.clientName.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory =
      selectedCategory === 'all' || f.category === selectedCategory;

    const matchesClient =
      selectedClientFilter === 'all' || f.clientName === selectedClientFilter;

    return matchesSearch && matchesCategory && matchesClient;
  });

  // Sort files
  const sortedFiles = [...filteredFiles].sort((a, b) => {
    if (sortBy === 'date-desc') {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    if (sortBy === 'date-asc') {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
    if (sortBy === 'name-asc') {
      return a.name.localeCompare(b.name);
    }
    if (sortBy === 'size-desc') {
      return b.size - a.size;
    }
    return 0;
  });

  const categories = [
    { id: 'all', label: 'All Files' },
    { id: 'documents', label: 'Documents' },
    { id: 'designs', label: 'Designs' },
    { id: 'images', label: 'Images' },
    { id: 'contracts', label: 'Contracts' },
    { id: 'other', label: 'Other' },
  ];

  const handleCopyLink = (file: StoredFileRecord) => {
    const shareUrl = `${window.location.origin}?fileId=${file.id}&client=${encodeURIComponent(file.clientName || 'vault')}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopiedFileId(file.id);
      setTimeout(() => setCopiedFileId(null), 2500);
    });
  };

  const getFileIcon = (file: StoredFileRecord) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif'].includes(ext || '') || file.type.startsWith('image/')) {
      return <ImageIcon className="w-5 h-5 text-amber-500" />;
    }
    if (['fig', 'sketch', 'psd', 'ai', 'xd', 'raw'].includes(ext || '')) {
      return <Layers className="w-5 h-5 text-purple-500" />;
    }
    return <FileText className="w-5 h-5 text-blue-500" />;
  };

  return (
    <div className="bg-white/50 backdrop-blur-2xl rounded-2xl border border-white/60 shadow-xl shadow-blue-950/10 overflow-hidden">
      {/* Frosted Controls & Search Toolbar */}
      <div className="p-4 sm:p-5 border-b border-white/40 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white/30 backdrop-blur-md">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search files by name or client..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm bg-white/70 backdrop-blur-md border border-white/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition text-slate-800 placeholder-slate-500 shadow-xs"
          />
        </div>

        {/* Filters and View Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Client Filter Dropdown */}
          <div className="flex items-center gap-1.5 bg-white/70 backdrop-blur-md border border-white/80 rounded-xl px-2.5 py-1.5 shadow-xs">
            <span className="text-xs text-slate-600 font-semibold">Client:</span>
            <select
              value={selectedClientFilter}
              onChange={(e) => setSelectedClientFilter(e.target.value)}
              className="text-xs font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
            >
              <option value="all">All Clients</option>
              {availableClients.map((client) => (
                <option key={client} value={client}>
                  {client}
                </option>
              ))}
            </select>
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-1.5 bg-white/70 backdrop-blur-md border border-white/80 rounded-xl px-2.5 py-1.5 shadow-xs">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="text-xs font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
            >
              <option value="date-desc">Newest First</option>
              <option value="date-asc">Oldest First</option>
              <option value="name-asc">Name (A-Z)</option>
              <option value="size-desc">Size (Largest)</option>
            </select>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-white/40 backdrop-blur-md p-1 rounded-xl border border-white/60 shadow-xs">
            <button
              onClick={() => setViewMode('list')}
              title="Table View"
              className={`p-1.5 rounded-lg text-xs transition cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-white text-blue-600 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ListIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              title="Grid View"
              className={`p-1.5 rounded-lg text-xs transition cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white text-blue-600 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Frosted Category Pills Bar */}
      <div className="px-5 py-3 border-b border-white/40 flex items-center gap-2 overflow-x-auto text-xs bg-white/30 backdrop-blur-md">
        <span className="text-slate-600 font-bold mr-1 text-[11px] uppercase tracking-wider">
          Categories:
        </span>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-3 py-1 rounded-xl font-semibold transition shrink-0 cursor-pointer backdrop-blur-xs ${
              selectedCategory === cat.id
                ? 'bg-white text-blue-700 border border-white/80 shadow-xs'
                : 'text-slate-700 hover:bg-white/50 border border-transparent'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Main Content: Files List / Grid / Empty State */}
      {sortedFiles.length === 0 ? (
        <div className="py-16 text-center px-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-white/50 backdrop-blur-md border border-white/60 text-slate-500 flex items-center justify-center mb-3">
            <FolderOpen className="w-7 h-7" />
          </div>
          <h4 className="text-sm font-bold text-slate-800">No files found</h4>
          <p className="text-xs text-slate-600 mt-1 max-w-sm mx-auto font-medium">
            {searchQuery
              ? `No files match your search "${searchQuery}". Try clearing filters.`
              : 'Upload your first file above to get started with your secure client portal.'}
          </p>
          {(searchQuery || selectedCategory !== 'all' || selectedClientFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
                setSelectedClientFilter('all');
              }}
              className="mt-4 px-3.5 py-1.5 text-xs font-semibold text-blue-700 bg-white/70 hover:bg-white/90 border border-white/80 rounded-xl transition shadow-xs"
            >
              Clear all filters
            </button>
          )}
        </div>
      ) : viewMode === 'list' ? (
        /* TABLE / LIST VIEW */
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-white/40 backdrop-blur-md text-[11px] font-bold text-slate-700 uppercase tracking-wider border-b border-white/40">
              <tr>
                <th className="py-3 px-5">File Name</th>
                <th className="py-3 px-4">Client / Project</th>
                <th className="py-3 px-4">File Size</th>
                <th className="py-3 px-4">Upload Date</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedFiles.map((file) => {
                const formattedDate = new Date(file.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                });

                return (
                    <tr
                    key={file.id}
                    className="hover:bg-white/45 transition-colors group"
                  >
                    {/* File Name */}
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-white/70 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/80 shadow-2xs">
                          {getFileIcon(file)}
                        </div>
                        <div className="min-w-0 max-w-xs sm:max-w-md">
                          <button
                            onClick={() => onPreviewFile(file)}
                            className="font-bold text-slate-800 hover:text-blue-600 truncate block text-left transition cursor-pointer"
                            title={file.name}
                          >
                            {file.name}
                          </button>
                          <span className="text-[10px] text-slate-500 font-mono uppercase font-semibold">
                            {file.name.split('.').pop() || 'FILE'}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Client Name */}
                    <td className="py-3.5 px-4 font-medium text-slate-700">
                      <span className="bg-white/60 text-slate-800 px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-white/70 shadow-2xs">
                        {file.clientName || 'General Vault'}
                      </span>
                    </td>

                    {/* File Size */}
                    <td className="py-3.5 px-4 text-slate-700 font-semibold">
                      {formatFileSize(file.size)}
                    </td>

                    {/* Upload Date */}
                    <td className="py-3.5 px-4 text-slate-600 font-medium whitespace-nowrap">
                      {formattedDate}
                    </td>

                    {/* Category */}
                    <td className="py-3.5 px-4">
                      <span className="capitalize text-[11px] font-semibold text-slate-700 bg-white/50 border border-white/60 px-2 py-0.5 rounded-md">
                        {file.category}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onPreviewFile(file)}
                          title="Preview File"
                          className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-white/70 rounded-lg transition cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => downloadFileRecord(file)}
                          title="Download File"
                          className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-white/70 rounded-lg transition cursor-pointer"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleCopyLink(file)}
                          title="Copy Share Link"
                          className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-white/70 rounded-lg transition cursor-pointer"
                        >
                          {copiedFileId === file.id ? (
                            <Check className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Share2 className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => setFileToDelete(file)}
                          title="Delete File"
                          className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-white/70 rounded-lg transition cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* GRID VIEW */
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {sortedFiles.map((file) => {
            const formattedDate = new Date(file.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric'
            });

            return (
              <div
                key={file.id}
                className="bg-white/60 hover:bg-white/85 backdrop-blur-md rounded-2xl border border-white/70 hover:border-blue-400/80 hover:shadow-lg transition p-4 flex flex-col justify-between group shadow-xs"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-white/80 border border-white/90 flex items-center justify-center shrink-0 shadow-2xs">
                      {getFileIcon(file)}
                    </div>
                    <span className="text-[10px] font-bold text-slate-700 bg-white/70 border border-white/80 px-2 py-0.5 rounded-full shadow-2xs">
                      {formatFileSize(file.size)}
                    </span>
                  </div>

                  <button
                    onClick={() => onPreviewFile(file)}
                    className="font-bold text-xs text-slate-900 hover:text-blue-600 line-clamp-2 text-left mb-1 transition cursor-pointer"
                    title={file.name}
                  >
                    {file.name}
                  </button>
                  <p className="text-[11px] text-blue-700 font-semibold truncate mb-2">
                    {file.clientName || 'General Vault'}
                  </p>
                </div>

                <div className="pt-3 border-t border-white/50 flex items-center justify-between mt-2">
                  <span className="text-[10px] text-slate-500 font-medium">{formattedDate}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onPreviewFile(file)}
                      title="Preview"
                      className="p-1 text-slate-600 hover:text-blue-600 hover:bg-white/70 rounded"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => downloadFileRecord(file)}
                      title="Download"
                      className="p-1 text-slate-600 hover:text-emerald-600 hover:bg-white/70 rounded"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setFileToDelete(file)}
                      title="Delete"
                      className="p-1 text-slate-600 hover:text-rose-600 hover:bg-white/70 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {fileToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white/75 backdrop-blur-3xl rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-white/80">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Delete File?</h3>
            <p className="text-xs text-slate-500 mt-1 mb-4 leading-relaxed">
              Are you sure you want to permanently remove{' '}
              <span className="font-semibold text-slate-800">"{fileToDelete.name}"</span>?
              This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setFileToDelete(null)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteFile(fileToDelete);
                  setFileToDelete(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm shadow-rose-500/20 transition cursor-pointer"
              >
                Delete File
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
