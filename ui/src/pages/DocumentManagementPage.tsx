// ─────────────────────────────────────────────────────────────────────────────
//  FILE 9:  frontend/src/pages/DocumentManagementPage.tsx
//  ACTION:  CREATE as a new file
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentApi } from '../services/api';
import { useAuth } from '../context/Authcontext';
import { useToast } from '../context/ToastContext';
import type { DocumentDto, DocumentSummaryDto, DocumentCategory } from '../types';
import { managerApi } from '../services/api';

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: { value: string; label: string; icon: string; color: string }[] = [
  { value: 'All',         label: 'All',          icon: '📁', color: 'text-slate-300' },
  { value: 'OfferLetter', label: 'Offer Letter',  icon: '📨', color: 'text-blue-400'  },
  { value: 'Contract',    label: 'Contract',      icon: '📝', color: 'text-purple-400'},
  { value: 'Payslip',     label: 'Payslip',       icon: '💰', color: 'text-green-400' },
  { value: 'IDProof',     label: 'ID Proof',      icon: '🪪', color: 'text-yellow-400'},
  { value: 'Certificate', label: 'Certificate',   icon: '🏆', color: 'text-amber-400' },
  { value: 'Policy',      label: 'Policy',        icon: '📋', color: 'text-cyan-400'  },
  { value: 'Appraisal',   label: 'Appraisal',     icon: '⭐', color: 'text-pink-400'  },
  { value: 'Warning',     label: 'Warning',       icon: '⚠️', color: 'text-red-400'   },
  { value: 'Other',       label: 'Other',         icon: '📎', color: 'text-slate-400' },
];

const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/plain',
];

const MAX_SIZE_MB = 20;

function getCategoryMeta(cat: string) {
  return CATEGORIES.find(c => c.value === cat) ?? CATEGORIES[CATEGORIES.length - 1];
}

function getFileIcon(mimeType: string): string {
  if (mimeType === 'application/pdf') return '📄';
  if (mimeType.includes('word'))       return '📝';
  if (mimeType.includes('excel') || mimeType.includes('sheet')) return '📊';
  if (mimeType.startsWith('image/'))   return '🖼️';
  return '📎';
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

// ─── Upload Modal ─────────────────────────────────────────────────────────────

interface UploadModalProps {
  onClose:     () => void;
  isManager:   boolean;
  allUsers?:   { id: number; fullName: string }[];
}

function UploadModal({ onClose, isManager, allUsers }: UploadModalProps) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [title,       setTitle]       = useState('');
  const [description, setDescription] = useState('');
  const [category,    setCategory]    = useState('Other');
  const [ownerUserId, setOwnerUserId] = useState(0);
  const [isPublic,    setIsPublic]    = useState(false);
  const [expiresAt,   setExpiresAt]   = useState('');
  const [file,        setFile]        = useState<File | null>(null);
  const [fileError,   setFileError]   = useState('');
  const [uploading,   setUploading]   = useState(false);
  const [progress,    setProgress]    = useState(0);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileError('');
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      setFileError(`File too large. Max ${MAX_SIZE_MB} MB.`);
      return;
    }
    if (!ALLOWED_TYPES.includes(f.type)) {
      setFileError('Unsupported file type. Allowed: PDF, Word, Excel, Images, Text.');
      return;
    }
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^/.]+$/, ''));
  };

  const handleSubmit = async () => {
    if (!title.trim()) { toast.error('Title is required.'); return; }
    if (!file)         { toast.error('Please select a file.'); return; }

    const fd = new FormData();
    fd.append('title',       title.trim());
    fd.append('description', description.trim());
    fd.append('category',    category);
    fd.append('ownerUserId', String(ownerUserId));
    fd.append('isPublic',    String(isPublic));
    if (expiresAt) fd.append('expiresAt', new Date(expiresAt).toISOString());
    fd.append('file', file);

    setUploading(true);
    // Simulate progress
    const interval = setInterval(() => setProgress(p => Math.min(p + 15, 90)), 200);
    try {
      await documentApi.upload(fd);
      clearInterval(interval);
      setProgress(100);
      qc.invalidateQueries({ queryKey: ['documents'] });
      qc.invalidateQueries({ queryKey: ['doc-summary'] });
      toast.success('Document uploaded successfully 📁');
      onClose();
    } catch {
      clearInterval(interval);
      toast.error('Upload failed. Please try again.');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="text-white font-semibold text-lg">Upload Document</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors text-xl">✕</button>
        </div>

        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">

          {/* File drop zone */}
          <div
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
              file
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-slate-600 hover:border-slate-500 bg-slate-800/50'
            }`}
          >
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.txt"
              onChange={handleFileChange}
            />
            {file ? (
              <div className="space-y-1">
                <div className="text-3xl">{getFileIcon(file.type)}</div>
                <p className="text-blue-400 font-medium text-sm">{file.name}</p>
                <p className="text-slate-400 text-xs">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-3xl">📤</div>
                <p className="text-slate-300 text-sm font-medium">Click to select file</p>
                <p className="text-slate-500 text-xs">PDF, Word, Excel, Images · Max {MAX_SIZE_MB} MB</p>
              </div>
            )}
          </div>
          {fileError && <p className="text-red-400 text-xs">{fileError}</p>}

          {/* Title */}
          <div>
            <label className="block text-slate-400 text-xs mb-1.5 font-medium">Title *</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Offer Letter - March 2026"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-slate-400 text-xs mb-1.5 font-medium">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="Optional notes about this document..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors resize-none"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-slate-400 text-xs mb-1.5 font-medium">Category</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            >
              {CATEGORIES.filter(c => c.value !== 'All').map(c => (
                <option key={c.value} value={c.value}>{c.icon} {c.label}</option>
              ))}
            </select>
          </div>

          {/* Manager: assign to employee */}
          {isManager && allUsers && (
            <div>
              <label className="block text-slate-400 text-xs mb-1.5 font-medium">Assign to Employee</label>
              <select
                value={ownerUserId}
                onChange={e => setOwnerUserId(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              >
                <option value={0}>— My own document —</option>
                {allUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.fullName}</option>
                ))}
              </select>
            </div>
          )}

          {/* Row: IsPublic + ExpiresAt */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-slate-400 text-xs mb-1.5 font-medium">Expiry Date (optional)</label>
              <input
                type="date"
                value={expiresAt}
                onChange={e => setExpiresAt(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <div
                  onClick={() => setIsPublic(!isPublic)}
                  className={`w-10 h-5 rounded-full transition-colors relative ${isPublic ? 'bg-blue-500' : 'bg-slate-600'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isPublic ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
                <span className="text-slate-400 text-xs">Company-wide</span>
              </label>
            </div>
          </div>

          {/* Upload progress */}
          {uploading && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Uploading…</span><span>{progress}%</span>
              </div>
              <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-slate-700">
          <button
            onClick={onClose}
            disabled={uploading}
            className="flex-1 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800 text-sm font-medium transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={uploading || !file || !title.trim()}
            className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-40"
          >
            {uploading ? 'Uploading…' : '📤 Upload'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

function EditModal({ doc, onClose }: { doc: DocumentDto; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [title,       setTitle]       = useState(doc.title);
  const [description, setDescription] = useState(doc.description ?? '');
  const [category,    setCategory]    = useState(doc.category);
  const [isPublic,    setIsPublic]    = useState(doc.isPublic);
  const [expiresAt,   setExpiresAt]   = useState(
    doc.expiresAt ? doc.expiresAt.split('T')[0] : ''
  );

  const mutation = useMutation({
    mutationFn: () => documentApi.update(doc.id, { title, description, category, isPublic, expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents'] });
      toast.success('Document updated.');
      onClose();
    },
    onError: () => toast.error('Update failed.'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="text-white font-semibold text-lg">Edit Document</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-slate-400 text-xs mb-1.5 font-medium">Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-slate-400 text-xs mb-1.5 font-medium">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 resize-none" />
          </div>
          <div>
            <label className="block text-slate-400 text-xs mb-1.5 font-medium">Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500">
              {CATEGORIES.filter(c => c.value !== 'All').map(c => (
                <option key={c.value} value={c.value}>{c.icon} {c.label}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-slate-400 text-xs mb-1.5 font-medium">Expiry Date</label>
              <input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <div onClick={() => setIsPublic(!isPublic)}
                  className={`w-10 h-5 rounded-full transition-colors relative ${isPublic ? 'bg-blue-500' : 'bg-slate-600'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isPublic ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
                <span className="text-slate-400 text-xs">Company-wide</span>
              </label>
            </div>
          </div>
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-slate-700">
          <button onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800 text-sm font-medium transition-colors">
            Cancel
          </button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending || !title.trim()}
            className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-40">
            {mutation.isPending ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Document Card ────────────────────────────────────────────────────────────

interface DocCardProps {
  doc:        DocumentDto;
  canManage:  boolean;
  onEdit:     (doc: DocumentDto) => void;
  onDelete:   (doc: DocumentDto) => void;
  onDownload: (doc: DocumentDto) => void;
}

function DocumentCard({ doc, canManage, onEdit, onDelete, onDownload }: DocCardProps) {
  const meta = getCategoryMeta(doc.category);

  return (
    <div className={`bg-slate-800/60 border rounded-xl p-4 flex flex-col gap-3 hover:bg-slate-800 transition-colors group ${
      doc.isExpired
        ? 'border-red-500/40'
        : doc.expiresWithin30Days
        ? 'border-yellow-500/40'
        : 'border-slate-700'
    }`}>
      {/* Top row: icon + title + badges */}
      <div className="flex items-start gap-3">
        <div className="text-2xl mt-0.5 shrink-0">{getFileIcon(doc.mimeType)}</div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium text-sm leading-tight truncate">{doc.title}</p>
          {doc.description && (
            <p className="text-slate-400 text-xs mt-0.5 line-clamp-2">{doc.description}</p>
          )}
        </div>
      </div>

      {/* Category + status badges */}
      <div className="flex flex-wrap gap-1.5">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-700 text-xs font-medium ${meta.color}`}>
          {meta.icon} {meta.label}
        </span>
        {doc.isPublic && (
          <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 text-xs font-medium">🌐 Company-wide</span>
        )}
        {doc.isExpired && (
          <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs font-medium">⛔ Expired</span>
        )}
        {!doc.isExpired && doc.expiresWithin30Days && (
          <span className="px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 text-xs font-medium">⚠️ Expiring soon</span>
        )}
      </div>

      {/* Meta info */}
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
        <span>📎 {doc.fileSizeLabel}</span>
        <span>📅 {formatDate(doc.uploadedAt)}</span>
        {doc.expiresAt && !doc.isExpired && (
          <span>🗓 Expires {formatDate(doc.expiresAt)}</span>
        )}
        {doc.ownerName && doc.ownerUserId !== doc.uploadedByUserId && (
          <span>👤 {doc.ownerName}</span>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onDownload(doc)}
          className="flex-1 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 text-xs font-medium transition-colors border border-blue-500/30"
        >
          ⬇ Download
        </button>
        {canManage && (
          <>
            <button
              onClick={() => onEdit(doc)}
              className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs transition-colors"
            >
              ✏️
            </button>
            <button
              onClick={() => onDelete(doc)}
              className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/40 text-red-400 text-xs transition-colors border border-red-500/20"
            >
              🗑
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function DocumentManagementPage() {
  const { user }  = useAuth();
  const { toast } = useToast();
  const qc        = useQueryClient();

  const isManager = user?.role === 'Manager' || user?.role === 'TeamLead';

  const [activeCategory, setActiveCategory]   = useState('All');
  const [searchQuery,    setSearchQuery]       = useState('');
  const [showUpload,     setShowUpload]        = useState(false);
  const [editDoc,        setEditDoc]           = useState<DocumentDto | null>(null);
  const [deleteDoc,      setDeleteDoc]         = useState<DocumentDto | null>(null);
  const [viewTab,        setViewTab]           = useState<'my' | 'all'>('my');

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: myDocs = [],   isLoading: myLoading  } = useQuery({
    queryKey: ['documents', 'my'],
    queryFn:  () => documentApi.getMy().then(r => r.data),
  });

  const { data: allDocs = [],  isLoading: allLoading } = useQuery({
    queryKey: ['documents', 'all'],
    queryFn:  () => documentApi.getAll().then(r => r.data),
    enabled:  isManager && viewTab === 'all',
  });

  const { data: summary } = useQuery<DocumentSummaryDto>({
    queryKey: ['doc-summary'],
    queryFn:  () => documentApi.getSummary().then(r => r.data),
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['all-users'],
    queryFn:  () => managerApi.getAllUsers().then(r => r.data),
    enabled:  isManager,
    });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (id: number) => documentApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents'] });
      qc.invalidateQueries({ queryKey: ['doc-summary'] });
      toast.success('Document deleted.');
      setDeleteDoc(null);
    },
    onError: () => toast.error('Delete failed.'),
  });

  const handleDownload = async (doc: DocumentDto) => {
    try {
      const res  = await documentApi.download(doc.id);
      const url  = URL.createObjectURL(new Blob([res.data], { type: doc.mimeType }));
      const link = document.createElement('a');
      link.href  = url;
      link.download = doc.fileName;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Download failed.');
    }
  };

  // ── Filtering ──────────────────────────────────────────────────────────────
  const sourceDocs = isManager && viewTab === 'all' ? allDocs : myDocs;
  const isLoading  = isManager && viewTab === 'all' ? allLoading : myLoading;

  const filtered = sourceDocs.filter(doc => {
    const matchCat    = activeCategory === 'All' || doc.category === activeCategory;
    const matchSearch = !searchQuery ||
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.description ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (viewTab === 'all' && doc.ownerName.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchCat && matchSearch;
  });

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">📁 Document Management</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {isManager ? 'Manage all employee documents' : 'Your documents and company files'}
          </p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition-colors shadow-lg shadow-blue-600/20"
        >
          📤 Upload Document
        </button>
      </div>

      {/* ── Summary Cards ───────────────────────────────────────────────────── */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total',    value: summary.totalDocuments,    icon: '📁', color: 'text-blue-400'   },
            { label: 'Mine',     value: summary.myDocuments,       icon: '👤', color: 'text-purple-400' },
            { label: 'Expiring', value: summary.expiringDocuments, icon: '⚠️', color: 'text-yellow-400' },
            { label: 'Expired',  value: summary.expiredDocuments,  icon: '⛔', color: 'text-red-400'    },
          ].map(s => (
            <div key={s.label} className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex items-center gap-3">
              <span className="text-2xl">{s.icon}</span>
              <div>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-slate-400 text-xs">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Manager tab: My / All ────────────────────────────────────────────── */}
      {isManager && (
        <div className="flex gap-2 bg-slate-800/50 rounded-xl p-1 w-fit">
          {(['my', 'all'] as const).map(t => (
            <button
              key={t}
              onClick={() => setViewTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                viewTab === t
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t === 'my' ? '👤 My Documents' : '👥 All Employees'}
            </button>
          ))}
        </div>
      )}

      {/* ── Category Filter + Search ─────────────────────────────────────────── */}
      <div className="space-y-3">
        {/* Category pills */}
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map(cat => {
            const count = cat.value === 'All'
              ? sourceDocs.length
              : sourceDocs.filter(d => d.category === cat.value).length;
            if (count === 0 && cat.value !== 'All') return null;
            return (
              <button
                key={cat.value}
                onClick={() => setActiveCategory(cat.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                  activeCategory === cat.value
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                }`}
              >
                {cat.icon} {cat.label}
                <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                  activeCategory === cat.value ? 'bg-blue-500/50' : 'bg-slate-700'
                }`}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search documents…"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
      </div>

      {/* ── Document Grid ────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-slate-800 border border-slate-700 rounded-xl p-4 h-44 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <div className="text-5xl mb-3">📭</div>
          <p className="font-medium text-slate-400">No documents found</p>
          <p className="text-sm mt-1">
            {searchQuery || activeCategory !== 'All'
              ? 'Try changing your filters.'
              : 'Upload your first document to get started.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(doc => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              canManage={isManager || (doc.ownerUserId === user?.id && doc.uploadedByUserId === user?.id)}
              onEdit={setEditDoc}
              onDelete={setDeleteDoc}
              onDownload={handleDownload}
            />
          ))}
        </div>
      )}

      {/* Results count */}
      {!isLoading && filtered.length > 0 && (
        <p className="text-slate-500 text-xs text-right">
          Showing {filtered.length} of {sourceDocs.length} documents
        </p>
      )}

      {/* ── Modals ───────────────────────────────────────────────────────────── */}
        {showUpload && (
        <UploadModal
            onClose={() => setShowUpload(false)}
            isManager={isManager}
            allUsers={allUsers}   // ← real list now
        />
        )}

      {editDoc && (
        <EditModal doc={editDoc} onClose={() => setEditDoc(null)} />
      )}

      {/* Delete confirm */}
      {deleteDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeleteDoc(null)} />
          <div className="relative bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4">
            <div className="text-center space-y-2">
              <div className="text-4xl">🗑️</div>
              <h3 className="text-white font-semibold text-lg">Delete Document?</h3>
              <p className="text-slate-400 text-sm">
                "<span className="text-white">{deleteDoc.title}</span>" will be permanently deleted.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteDoc(null)}
                className="flex-1 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteDoc.id)}
                disabled={deleteMutation.isPending}
                className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}