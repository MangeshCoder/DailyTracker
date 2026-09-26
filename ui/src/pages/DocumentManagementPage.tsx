// ─────────────────────────────────────────────────────────────────────────────
//  FILE: ui/src/pages/DocumentManagementPage.tsx
//  Document Management Hub - Modern Design System Upgrade
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentApi, managerApi } from '../services/api';
import { useAuth } from '../context/Authcontext';
import { useToast } from '../context/ToastContext';
import type { DocumentDto, DocumentSummaryDto } from '../types';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Card, CardContent } from '../components/ui/Card';
import {
  FileText,
  Upload,
  Download,
  Trash2,
  Edit3,
  Calendar,
  AlertTriangle,
  AlertCircle,
  Globe,
  User,
  Search,
  X,
  Plus,
  FileSpreadsheet,
  Image as ImageIcon,
  FileCode,
  File,
  LayoutGrid,
  List,
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: { value: string; label: string; icon: string; color: string; bg: string }[] = [
  { value: 'All',         label: 'All Documents', icon: '📁', color: 'text-slate-700 dark:text-slate-300', bg: 'bg-slate-100 dark:bg-slate-800' },
  { value: 'OfferLetter', label: 'Offer Letter',  icon: '📨', color: 'text-blue-700 dark:text-blue-400',   bg: 'bg-blue-50 dark:bg-blue-900/30' },
  { value: 'Contract',    label: 'Contract',      icon: '📝', color: 'text-purple-700 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/30' },
  { value: 'Payslip',     label: 'Payslip',       icon: '💰', color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/30' },
  { value: 'IDProof',     label: 'ID Proof',      icon: '🪪', color: 'text-amber-700 dark:text-amber-400',   bg: 'bg-amber-50 dark:bg-amber-900/30' },
  { value: 'Certificate', label: 'Certificate',   icon: '🏆', color: 'text-indigo-700 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-900/30' },
  { value: 'Policy',      label: 'Policy',        icon: '📋', color: 'text-cyan-700 dark:text-cyan-400',     bg: 'bg-cyan-50 dark:bg-cyan-900/30' },
  { value: 'Appraisal',   label: 'Appraisal',     icon: '⭐', color: 'text-pink-700 dark:text-pink-400',     bg: 'bg-pink-50 dark:bg-pink-900/30' },
  { value: 'Warning',     label: 'Warning',       icon: '⚠️', color: 'text-rose-700 dark:text-rose-400',     bg: 'bg-rose-50 dark:bg-rose-900/30' },
  { value: 'Other',       label: 'Other',         icon: '📎', color: 'text-slate-700 dark:text-slate-400',   bg: 'bg-slate-100 dark:bg-slate-800' },
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

const MAX_SIZE_MB = 25;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCategoryMeta(category: string) {
  return (
    CATEGORIES.find((c) => c.value === category) ?? {
      value: category,
      label: category,
      icon: '📄',
      color: 'text-slate-700 dark:text-slate-300',
      bg: 'bg-slate-100 dark:bg-slate-800',
    }
  );
}

function getFileIconComponent(mimeType: string) {
  if (mimeType.includes('pdf')) {
    return <FileText className="w-5 h-5 text-rose-500" />;
  }
  if (mimeType.includes('word') || mimeType.includes('document')) {
    return <FileText className="w-5 h-5 text-blue-500" />;
  }
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet') || mimeType.includes('csv')) {
    return <FileSpreadsheet className="w-5 h-5 text-emerald-500" />;
  }
  if (mimeType.includes('image')) {
    return <ImageIcon className="w-5 h-5 text-purple-500" />;
  }
  if (mimeType.includes('text')) {
    return <FileCode className="w-5 h-5 text-amber-500" />;
  }
  return <File className="w-5 h-5 text-slate-500" />;
}

function formatDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// ─── Upload Modal ─────────────────────────────────────────────────────────────

interface UploadModalProps {
  onClose: () => void;
  isManager: boolean;
  allUsers?: { id: number; fullName: string }[];
}

function UploadModal({ onClose, isManager, allUsers }: UploadModalProps) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Other');
  const [ownerUserId, setOwnerUserId] = useState(0);
  const [isPublic, setIsPublic] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const processFile = (f: File) => {
    setFileError('');
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      setFileError(`File is too large (${(f.size / (1024 * 1024)).toFixed(1)} MB). Maximum allowed is ${MAX_SIZE_MB} MB.`);
      return;
    }
    if (!ALLOWED_TYPES.includes(f.type)) {
      setFileError('Unsupported file type. Please upload a PDF, Word, Excel, Image, or Text file.');
      return;
    }
    setFile(f);
    if (!title) {
      setTitle(f.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) processFile(f);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Document title is required.');
      return;
    }
    if (!file) {
      toast.error('Please select a file to upload.');
      return;
    }

    const fd = new FormData();
    fd.append('title', title.trim());
    fd.append('description', description.trim());
    fd.append('category', category);
    fd.append('ownerUserId', String(ownerUserId));
    fd.append('isPublic', String(isPublic));
    if (expiresAt) {
      fd.append('expiresAt', new Date(expiresAt).toISOString());
    }
    fd.append('file', file);

    setUploading(true);
    const interval = setInterval(() => setProgress((p) => Math.min(p + 15, 90)), 200);

    try {
      await documentApi.upload(fd);
      clearInterval(interval);
      setProgress(100);
      qc.invalidateQueries({ queryKey: ['documents'] });
      qc.invalidateQueries({ queryKey: ['doc-summary'] });
      toast.success('Document uploaded successfully!');
      onClose();
    } catch {
      clearInterval(interval);
      toast.error('Failed to upload document. Please try again.');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Upload New Document</h2>
              <p className="text-xs text-slate-500">Store file securely with category tags and permissions</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* File drop zone */}
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 ${
              isDragging
                ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 scale-[0.99]'
                : file
                ? 'border-emerald-500/60 bg-emerald-50/30 dark:bg-emerald-900/10'
                : 'border-slate-300 dark:border-slate-700 hover:border-blue-400 dark:hover:border-slate-600 bg-slate-50/50 dark:bg-slate-800/30'
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
              <div className="flex flex-col items-center gap-2">
                <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl text-emerald-600 dark:text-emerald-400">
                  {getFileIconComponent(file.type)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{file.name}</p>
                  <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB • Click or drag to replace</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-slate-500">
                <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-2xl text-blue-600 dark:text-blue-400">
                  <Upload className="w-6 h-6" />
                </div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Click to select file or drag & drop here
                </p>
                <p className="text-xs text-slate-400">
                  PDF, Word, Excel, Images, Text • Up to {MAX_SIZE_MB} MB
                </p>
              </div>
            )}
          </div>
          {fileError && <p className="text-xs font-medium text-rose-500">{fileError}</p>}

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Document Title <span className="text-rose-500">*</span>
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Employment Contract 2026"
              className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Description <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Add brief notes or summary regarding this document..."
              className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition resize-none"
            />
          </div>

          {/* Category & Manager User Assignment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                {CATEGORIES.filter((c) => c.value !== 'All').map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.icon} {c.label}
                  </option>
                ))}
              </select>
            </div>

            {isManager && allUsers && allUsers.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Assign to Employee
                </label>
                <select
                  value={ownerUserId}
                  onChange={(e) => setOwnerUserId(Number(e.target.value))}
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value={0}>— My own document —</option>
                  {allUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Expiry Date & Company-wide toggle */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 items-end">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Expiry Date <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                <span className="text-xs font-medium text-slate-700 dark:text-slate-200">Company-wide</span>
              </div>
              <button
                type="button"
                onClick={() => setIsPublic(!isPublic)}
                className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isPublic ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    isPublic ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Progress bar */}
          {uploading && (
            <div className="space-y-1.5 pt-2">
              <div className="flex justify-between text-xs font-medium text-slate-600 dark:text-slate-400">
                <span>Uploading document…</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Footer actions */}
          <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={uploading}
              className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading || !file || !title.trim()}
              className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition shadow-md shadow-blue-600/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {uploading ? (
                <span>Uploading…</span>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>Upload Document</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

interface EditModalProps {
  doc: DocumentDto;
  onClose: () => void;
}

function EditModal({ doc, onClose }: EditModalProps) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [title, setTitle] = useState(doc.title);
  const [description, setDescription] = useState(doc.description ?? '');
  const [category, setCategory] = useState(doc.category);
  const [isPublic, setIsPublic] = useState(doc.isPublic);
  const [expiresAt, setExpiresAt] = useState(
    doc.expiresAt ? doc.expiresAt.split('T')[0] : ''
  );

  const mutation = useMutation({
    mutationFn: () =>
      documentApi.update(doc.id, {
        title,
        description,
        category,
        isPublic,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents'] });
      qc.invalidateQueries({ queryKey: ['doc-summary'] });
      toast.success('Document updated successfully!');
      onClose();
    },
    onError: () => toast.error('Failed to update document.'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Edit Document Details</h2>
              <p className="text-xs text-slate-500">Update metadata and access options</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Title <span className="text-rose-500">*</span>
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              {CATEGORIES.filter((c) => c.value !== 'All').map((c) => (
                <option key={c.value} value={c.value}>
                  {c.icon} {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 items-end">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Expiry Date
              </label>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                <span className="text-xs font-medium text-slate-700 dark:text-slate-200">Company-wide</span>
              </div>
              <button
                type="button"
                onClick={() => setIsPublic(!isPublic)}
                className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isPublic ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    isPublic ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <button
            onClick={onClose}
            className="flex-1 py-2 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium transition"
          >
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !title.trim()}
            className="flex-1 py-2 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition shadow-md shadow-blue-600/20 disabled:opacity-40"
          >
            {mutation.isPending ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Document Card (Grid Item) ────────────────────────────────────────────────

interface DocCardProps {
  doc: DocumentDto;
  canManage: boolean;
  onEdit: (doc: DocumentDto) => void;
  onDelete: (doc: DocumentDto) => void;
  onDownload: (doc: DocumentDto) => void;
}

function DocumentCard({ doc, canManage, onEdit, onDelete, onDownload }: DocCardProps) {
  const meta = getCategoryMeta(doc.category);

  return (
    <Card hover className="flex flex-col justify-between overflow-hidden group border-slate-200 dark:border-slate-800">
      <CardContent className="p-5 flex flex-col gap-3">
        {/* Top: Icon + Title + Status badges */}
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shrink-0 group-hover:scale-105 transition-transform">
            {getFileIconComponent(doc.mimeType)}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-900 dark:text-white text-sm leading-tight truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {doc.title}
            </h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5 font-mono">
              {doc.fileName}
            </p>
          </div>
        </div>

        {/* Description */}
        {doc.description && (
          <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
            {doc.description}
          </p>
        )}

        {/* Category + Public + Expiry Badges */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-medium ${meta.bg} ${meta.color}`}>
            <span>{meta.icon}</span>
            <span>{meta.label}</span>
          </span>

          {doc.isPublic && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium bg-cyan-50 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400">
              <Globe className="w-3 h-3" />
              <span>Public</span>
            </span>
          )}

          {doc.isExpired && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400">
              <AlertCircle className="w-3 h-3" />
              <span>Expired</span>
            </span>
          )}

          {!doc.isExpired && doc.expiresWithin30Days && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="w-3 h-3" />
              <span>Expiring Soon</span>
            </span>
          )}
        </div>

        {/* Details / Metadata */}
        <div className="grid grid-cols-2 gap-y-1.5 gap-x-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5 truncate">
            <span className="text-slate-400">Size:</span>
            <span className="font-medium text-slate-700 dark:text-slate-300">{doc.fileSizeLabel}</span>
          </div>

          <div className="flex items-center gap-1.5 truncate">
            <span className="text-slate-400">Added:</span>
            <span className="font-medium text-slate-700 dark:text-slate-300">{formatDate(doc.uploadedAt)}</span>
          </div>

          {doc.expiresAt && !doc.isExpired && (
            <div className="col-span-2 flex items-center gap-1.5 truncate">
              <Calendar className="w-3 h-3 text-amber-500" />
              <span className="text-slate-400">Expires:</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">{formatDate(doc.expiresAt)}</span>
            </div>
          )}

          {doc.ownerName && doc.ownerUserId !== doc.uploadedByUserId && (
            <div className="col-span-2 flex items-center gap-1.5 truncate">
              <User className="w-3 h-3 text-purple-500" />
              <span className="text-slate-400">Owner:</span>
              <span className="font-medium text-slate-700 dark:text-slate-300 truncate">{doc.ownerName}</span>
            </div>
          )}
        </div>
      </CardContent>

      {/* Action Footer */}
      <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-850/50 flex items-center gap-2">
        <button
          onClick={() => onDownload(doc)}
          className="flex-1 py-1.5 px-3 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-xs font-medium transition flex items-center justify-center gap-1.5 border border-blue-200 dark:border-blue-800/40"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download</span>
        </button>

        {canManage && (
          <>
            <button
              onClick={() => onEdit(doc)}
              title="Edit document"
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onDelete(doc)}
              title="Delete document"
              className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
    </Card>
  );
}

// ─── Main Page Component ──────────────────────────────────────────────────────

export function DocumentManagementPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const isManager = user?.role === 'Manager' || user?.role === 'TeamLead';
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [editDoc, setEditDoc] = useState<DocumentDto | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<DocumentDto | null>(null);
  const [viewTab, setViewTab] = useState<'my' | 'all'>('my');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: myDocs = [], isLoading: myLoading } = useQuery({
    queryKey: ['documents', 'my'],
    queryFn: () => documentApi.getMy().then((r) => r.data),
  });

  const { data: allDocs = [], isLoading: allLoading } = useQuery({
    queryKey: ['documents', 'all'],
    queryFn: () => documentApi.getAll().then((r) => r.data),
    enabled: isManager && viewTab === 'all',
  });

  const { data: summary } = useQuery<DocumentSummaryDto>({
    queryKey: ['doc-summary'],
    queryFn: () => documentApi.getSummary().then((r) => r.data),
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['all-users'],
    queryFn: () => managerApi.getAllUsers().then((r) => r.data),
    enabled: isManager,
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (id: number) => documentApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents'] });
      qc.invalidateQueries({ queryKey: ['doc-summary'] });
      toast.success('Document deleted successfully.');
      setDeleteDoc(null);
    },
    onError: () => toast.error('Failed to delete document.'),
  });

  const handleDownload = async (doc: DocumentDto) => {
    try {
      const res = await documentApi.download(doc.id);
      const url = URL.createObjectURL(new Blob([res.data], { type: doc.mimeType }));
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.fileName;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Download failed.');
    }
  };

  // ── Filtering ──────────────────────────────────────────────────────────────
  const sourceDocs = isManager && viewTab === 'all' ? allDocs : myDocs;
  const isLoading = isManager && viewTab === 'all' ? allLoading : myLoading;

  const filtered = useMemo(() => {
    return sourceDocs.filter((doc) => {
      const matchCat = activeCategory === 'All' || doc.category === activeCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        doc.title.toLowerCase().includes(q) ||
        doc.fileName.toLowerCase().includes(q) ||
        (doc.description ?? '').toLowerCase().includes(q) ||
        (viewTab === 'all' && (doc.ownerName ?? '').toLowerCase().includes(q));
      return matchCat && matchSearch;
    });
  }, [sourceDocs, activeCategory, searchQuery, viewTab]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <PageHeader
        title="Document Management"
        description={
          isManager
            ? 'Manage all employee records, contracts, policies, and company documentation.'
            : 'Access your contracts, payslips, tax certificates, and public company documents.'
        }
        badge={{
          label: isManager ? 'HR & Administration' : 'My Documents',
          variant: 'blue',
          icon: <FileText className="w-3.5 h-3.5" />,
        }}
        actions={
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition shadow-md shadow-blue-600/20 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Upload Document</span>
          </button>
        }
      />

      {/* ── Summary Stats ───────────────────────────────────────────────────── */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Documents"
            value={summary.totalDocuments}
            subtitle="Uploaded in workspace"
            icon={FileText}
            color="blue"
          />
          <StatCard
            title="My Documents"
            value={summary.myDocuments}
            subtitle="Assigned to your profile"
            icon={User}
            color="purple"
          />
          <StatCard
            title="Expiring Soon"
            value={summary.expiringDocuments}
            subtitle="Within next 30 days"
            icon={AlertTriangle}
            color="amber"
          />
          <StatCard
            title="Expired Files"
            value={summary.expiredDocuments}
            subtitle="Action required"
            icon={AlertCircle}
            color="rose"
          />
        </div>
      )}

      {/* ── Toolbar & Filter Bar ────────────────────────────────────────────── */}
      <Card className="p-4 space-y-4 border-slate-200 dark:border-slate-800">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Manager Tab Selector */}
          {isManager ? (
            <div className="flex p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl w-fit">
              <button
                onClick={() => setViewTab('my')}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
                  viewTab === 'my'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>My Documents</span>
              </button>
              <button
                onClick={() => setViewTab('all')}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
                  viewTab === 'all'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>All Employees</span>
              </button>
            </div>
          ) : (
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Document Archive
            </div>
          )}

          {/* Search + View mode */}
          <div className="flex items-center gap-2.5 flex-1 max-w-md ml-auto">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title, filename, or owner…"
                className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* View Mode Toggle */}
            <div className="flex p-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/80">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                }`}
                title="Grid view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg transition ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                }`}
                title="Table view"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex gap-1.5 flex-wrap pt-1 border-t border-slate-100 dark:border-slate-800/80">
          {CATEGORIES.map((cat) => {
            const count =
              cat.value === 'All'
                ? sourceDocs.length
                : sourceDocs.filter((d) => d.category === cat.value).length;
            if (count === 0 && cat.value !== 'All') return null;

            const isSelected = activeCategory === cat.value;
            return (
              <button
                key={cat.value}
                onClick={() => setActiveCategory(cat.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-xs shadow-blue-600/20'
                    : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
                <span
                  className={`ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    isSelected
                      ? 'bg-blue-700/60 text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* ── Content View ──────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="p-5 h-48 animate-pulse space-y-3">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-800" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-3/4" />
                  <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-1/2" />
                </div>
              </div>
              <div className="h-12 bg-slate-200 dark:bg-slate-800 rounded-lg" />
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="py-16 text-center border-dashed border-slate-200 dark:border-slate-800">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-500">
            <FileText className="w-7 h-7" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">No documents found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            {searchQuery || activeCategory !== 'All'
              ? 'No documents matched your current search filters. Try clearing your query.'
              : 'Upload your first document to keep your records organized and securely backed up.'}
          </p>
          {(searchQuery || activeCategory !== 'All') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setActiveCategory('All');
              }}
              className="mt-4 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition"
            >
              Reset Filters
            </button>
          )}
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((doc) => (
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
      ) : (
        /* Table / List View */
        <Card className="overflow-hidden border-slate-200 dark:border-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Document</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Owner</th>
                  <th className="py-3 px-4">Size</th>
                  <th className="py-3 px-4">Date Added</th>
                  <th className="py-3 px-4">Expires</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {filtered.map((doc) => {
                  const meta = getCategoryMeta(doc.category);
                  const canManage =
                    isManager ||
                    (doc.ownerUserId === user?.id && doc.uploadedByUserId === user?.id);

                  return (
                    <tr
                      key={doc.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition group"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0">
                            {getFileIconComponent(doc.mimeType)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 dark:text-white truncate max-w-xs group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                              {doc.title}
                            </p>
                            <p className="text-[11px] text-slate-400 truncate max-w-xs font-mono">
                              {doc.fileName}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-medium ${meta.bg} ${meta.color}`}>
                          <span>{meta.icon}</span>
                          <span>{meta.label}</span>
                        </span>
                      </td>

                      <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">
                        {doc.ownerName ?? '—'}
                      </td>

                      <td className="py-3 px-4 font-mono text-slate-500">
                        {doc.fileSizeLabel}
                      </td>

                      <td className="py-3 px-4 text-slate-500">
                        {formatDate(doc.uploadedAt)}
                      </td>

                      <td className="py-3 px-4">
                        {doc.isExpired ? (
                          <span className="text-rose-600 dark:text-rose-400 font-semibold">
                            Expired ({formatDate(doc.expiresAt)})
                          </span>
                        ) : doc.expiresWithin30Days ? (
                          <span className="text-amber-600 dark:text-amber-400 font-semibold">
                            Exp. {formatDate(doc.expiresAt)}
                          </span>
                        ) : doc.expiresAt ? (
                          <span className="text-slate-500">{formatDate(doc.expiresAt)}</span>
                        ) : (
                          <span className="text-slate-400">Never</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleDownload(doc)}
                            className="p-1.5 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition"
                            title="Download document"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          {canManage && (
                            <>
                              <button
                                onClick={() => setEditDoc(doc)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                                title="Edit document"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setDeleteDoc(doc)}
                                className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition"
                                title="Delete document"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── Modals ───────────────────────────────────────────────────────────── */}
      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          isManager={isManager}
          allUsers={allUsers}
        />
      )}

      {editDoc && <EditModal doc={editDoc} onClose={() => setEditDoc(null)} />}

      {/* Delete Confirmation Modal */}
      {deleteDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Delete Document?</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                "<span className="font-semibold text-slate-800 dark:text-slate-200">{deleteDoc.title}</span>" will be permanently removed. This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setDeleteDoc(null)}
                className="flex-1 py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteDoc.id)}
                disabled={deleteMutation.isPending}
                className="flex-1 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition shadow-md shadow-rose-600/20 disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Delete Document'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}