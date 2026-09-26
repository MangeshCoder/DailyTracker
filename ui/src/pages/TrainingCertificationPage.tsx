import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { trainingApi } from '../services/api';
import { useAuth } from '../context/Authcontext';
import { useToast } from '../context/ToastContext';
import type {
  TrainingDto,
  CertificationDto,
  TrainingStatsDto,
  TeamTrainingStatsDto,
  CreateTrainingDto,
  UpdateTrainingDto,
  CreateCertificationDto,
  UpdateCertificationDto,
} from '../types';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import {
  GraduationCap,
  Award,
  Clock,
  Calendar,
  ExternalLink,
  Download,
  Edit3,
  Trash2,
  Building2,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Sparkles,
  BookOpen,
  ShieldCheck,
  Plus,
  Search,
  X,
  Users,
  User,
  Paperclip,
  Check
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────
const TRAINING_TYPES = [
  'Online',
  'Internal',
  'External',
  'Conference',
  'Workshop',
  'Certification',
];

const TRAINING_STATUSES = ['Planned', 'InProgress', 'Completed', 'Cancelled'];

const STATUS_META: Record<
  string,
  { label: string; text: string; bg: string; border: string }
> = {
  Planned: {
    label: 'Planned',
    text: 'text-blue-700 dark:text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/25',
  },
  InProgress: {
    label: 'In Progress',
    text: 'text-amber-700 dark:text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/25',
  },
  Completed: {
    label: 'Completed',
    text: 'text-emerald-700 dark:text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/25',
  },
  Cancelled: {
    label: 'Cancelled',
    text: 'text-slate-600 dark:text-slate-400',
    bg: 'bg-slate-100 dark:bg-slate-800',
    border: 'border-slate-200 dark:border-slate-700',
  },
  Active: {
    label: 'Active & Verified',
    text: 'text-emerald-700 dark:text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/25',
  },
  Expired: {
    label: 'Expired',
    text: 'text-rose-700 dark:text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/25',
  },
  Revoked: {
    label: 'Revoked',
    text: 'text-slate-600 dark:text-slate-400',
    bg: 'bg-slate-100 dark:bg-slate-800',
    border: 'border-slate-200 dark:border-slate-700',
  },
};

const TYPE_ICONS: Record<string, string> = {
  Online: '💻',
  Internal: '🏢',
  External: '🌐',
  Conference: '🎤',
  Workshop: '🛠️',
  Certification: '🏆',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? STATUS_META.Planned;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${meta.bg} ${meta.border} ${meta.text}`}
    >
      {meta.label}
    </span>
  );
}

// ─── Add Training Modal ───────────────────────────────────────────────────────
interface AddTrainingModalProps {
  edit?: TrainingDto;
  onClose: () => void;
}

function AddTrainingModal({ edit, onClose }: AddTrainingModalProps) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [form, setForm] = useState<CreateTrainingDto>({
    title: edit?.title ?? '',
    provider: edit?.provider ?? '',
    trainingType: edit?.trainingType ?? 'Online',
    description: edit?.description ?? '',
    startDate: edit?.startDate ? edit.startDate.split('T')[0] : '',
    endDate: edit?.endDate ? edit.endDate.split('T')[0] : '',
    durationHours: edit?.durationHours ?? 0,
    status: edit?.status ?? 'Planned',
    notes: edit?.notes ?? '',
    courseUrl: edit?.courseUrl ?? '',
  });

  const set = (k: keyof CreateTrainingDto, v: any) =>
    setForm((f) => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: () =>
      edit
        ? trainingApi.updateTraining(edit.id, form as UpdateTrainingDto)
        : trainingApi.createTraining(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-trainings'] });
      qc.invalidateQueries({ queryKey: ['all-trainings'] });
      qc.invalidateQueries({ queryKey: ['training-stats'] });
      toast.success(
        edit ? 'Training course updated.' : 'Training program recorded 🎓'
      );
      onClose();
    },
    onError: () => toast.error('Failed to save training entry.'),
  });

  const inputCls =
    'w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors';
  const labelCls =
    'block text-slate-700 dark:text-slate-300 text-xs mb-1.5 font-bold uppercase tracking-wider';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {edit ? 'Update Training Program' : 'Record New Training'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Document your coursework, seminars, or internal learning workshops.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Title */}
          <div>
            <label className={labelCls}>Course / Program Title *</label>
            <input
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="e.g. AWS Certified Solutions Architect Associate"
              className={inputCls}
            />
          </div>

          {/* Provider + Type row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className={labelCls}>Provider / Platform</label>
              <input
                value={form.provider ?? ''}
                onChange={(e) => set('provider', e.target.value)}
                placeholder="Coursera, Udemy, Internal..."
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Learning Format</label>
              <select
                value={form.trainingType}
                onChange={(e) => set('trainingType', e.target.value)}
                className={inputCls}
              >
                {TRAINING_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_ICONS[t]} {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className={labelCls}>Curriculum Summary</label>
            <textarea
              value={form.description ?? ''}
              onChange={(e) => set('description', e.target.value)}
              rows={2}
              placeholder="Key skills acquired, modules covered, or core tech stack…"
              className={`${inputCls} resize-none`}
            />
          </div>

          {/* Dates row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className={labelCls}>Commencement Date *</label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => set('startDate', e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Completion Date</label>
              <input
                type="date"
                value={form.endDate ?? ''}
                onChange={(e) => set('endDate', e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          {/* Hours + Status row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className={labelCls}>Total Duration (hours)</label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={form.durationHours}
                onChange={(e) =>
                  set('durationHours', parseFloat(e.target.value) || 0)
                }
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Current Progress Status</label>
              <select
                value={form.status}
                onChange={(e) => set('status', e.target.value)}
                className={inputCls}
              >
                {TRAINING_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Course URL */}
          <div>
            <label className={labelCls}>Course / Syllabus URL</label>
            <input
              value={form.courseUrl ?? ''}
              onChange={(e) => set('courseUrl', e.target.value)}
              placeholder="https://..."
              className={inputCls}
            />
          </div>

          {/* Notes */}
          <div>
            <label className={labelCls}>Personal Notes & Key Takeaways</label>
            <textarea
              value={form.notes ?? ''}
              onChange={(e) => set('notes', e.target.value)}
              rows={2}
              placeholder="Practical takeaways, projects built, or cert vouchers received…"
              className={`${inputCls} resize-none`}
            />
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-950/20 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs sm:text-sm font-semibold transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={
              mutation.isPending || !form.title.trim() || !form.startDate
            }
            className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-semibold transition disabled:opacity-40 shadow-sm shadow-blue-500/20 cursor-pointer"
          >
            {mutation.isPending
              ? 'Saving…'
              : edit
              ? 'Save Changes'
              : 'Add Training'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Certification Modal ──────────────────────────────────────────────────
interface AddCertModalProps {
  edit?: CertificationDto;
  onClose: () => void;
}

function AddCertModal({ edit, onClose }: AddCertModalProps) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<CreateCertificationDto>({
    name: edit?.name ?? '',
    issuingOrganization: edit?.issuingOrganization ?? '',
    issueDate: edit?.issueDate ? edit.issueDate.split('T')[0] : '',
    expiryDate: edit?.expiryDate ? edit.expiryDate.split('T')[0] : '',
    credentialId: edit?.credentialId ?? '',
    credentialUrl: edit?.credentialUrl ?? '',
  });
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const [uploading, setUploading] = useState(false);

  const set = (k: keyof CreateCertificationDto, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileError('');
    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'image/webp',
    ];
    if (f.size > 10 * 1024 * 1024) {
      setFileError('Max file size is 10 MB.');
      return;
    }
    if (!allowed.includes(f.type)) {
      setFileError('Permitted formats: PDF, Word document, or image files.');
      return;
    }
    setFile(f);
  };

  const handleSubmit = async () => {
    if (
      !form.name.trim() ||
      !form.issuingOrganization.trim() ||
      !form.issueDate
    ) {
      toast.error('Credential Name, Issuing Organization, and Issue Date are required.');
      return;
    }

    setUploading(true);
    try {
      if (edit) {
        const upd: UpdateCertificationDto = {
          name: form.name,
          issuingOrganization: form.issuingOrganization,
          issueDate: form.issueDate
            ? new Date(form.issueDate).toISOString()
            : undefined,
          expiryDate: form.expiryDate
            ? new Date(form.expiryDate).toISOString()
            : undefined,
          credentialId: form.credentialId,
          credentialUrl: form.credentialUrl,
        };
        await trainingApi.updateCertification(edit.id, upd);
      } else {
        const fd = new FormData();
        fd.append('name', form.name);
        fd.append('issuingOrganization', form.issuingOrganization);
        fd.append('issueDate', new Date(form.issueDate).toISOString());
        if (form.expiryDate)
          fd.append('expiryDate', new Date(form.expiryDate).toISOString());
        if (form.credentialId) fd.append('credentialId', form.credentialId);
        if (form.credentialUrl) fd.append('credentialUrl', form.credentialUrl);
        if (file) fd.append('File', file);
        await trainingApi.createCertification(fd);
      }
      qc.invalidateQueries({ queryKey: ['my-certs'] });
      qc.invalidateQueries({ queryKey: ['all-certs'] });
      qc.invalidateQueries({ queryKey: ['training-stats'] });
      toast.success(
        edit ? 'Certification record updated.' : 'Official certification verified 🏆'
      );
      onClose();
    } catch {
      toast.error('Failed to save certification record.');
    } finally {
      setUploading(false);
    }
  };

  const inputCls =
    'w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors';
  const labelCls =
    'block text-slate-700 dark:text-slate-300 text-xs mb-1.5 font-bold uppercase tracking-wider';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {edit ? 'Update Professional Credential' : 'Register Credential'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Upload verified licenses, industry badges, and digital credentials.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Name */}
          <div>
            <label className={labelCls}>Credential / Certification Title *</label>
            <input
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. Certified Information Systems Security Professional"
              className={inputCls}
            />
          </div>

          {/* Organization */}
          <div>
            <label className={labelCls}>Issuing Institution / Authority *</label>
            <input
              value={form.issuingOrganization}
              onChange={(e) => set('issuingOrganization', e.target.value)}
              placeholder="e.g. ISC2, Amazon Web Services, Microsoft"
              className={inputCls}
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className={labelCls}>Issue Date *</label>
              <input
                type="date"
                value={form.issueDate}
                onChange={(e) => set('issueDate', e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Expiry Date (if applicable)</label>
              <input
                type="date"
                value={form.expiryDate ?? ''}
                onChange={(e) => set('expiryDate', e.target.value)}
                className={inputCls}
              />
              <p className="text-slate-400 text-[11px] mt-1">
                Leave blank if credential is lifetime or non-expiring.
              </p>
            </div>
          </div>

          {/* Credential ID + URL */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className={labelCls}>Credential ID / Serial</label>
              <input
                value={form.credentialId ?? ''}
                onChange={(e) => set('credentialId', e.target.value)}
                placeholder="e.g. AWS-PSA-99120"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Verification URL</label>
              <input
                value={form.credentialUrl ?? ''}
                onChange={(e) => set('credentialUrl', e.target.value)}
                placeholder="https://credly.com/badges/..."
                className={inputCls}
              />
            </div>
          </div>

          {/* File upload — only for new certs */}
          {!edit && (
            <div>
              <label className={labelCls}>Certificate Attachment (Optional)</label>
              <div
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition ${
                  file
                    ? 'border-blue-500 bg-blue-500/5'
                    : 'border-slate-300 dark:border-slate-700 hover:border-blue-400 bg-slate-50/50 dark:bg-slate-950/40'
                }`}
              >
                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                  onChange={handleFileChange}
                />
                {file ? (
                  <div className="space-y-1">
                    <p className="text-blue-600 dark:text-blue-400 font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5">
                      <Paperclip className="w-4 h-4" />
                      <span>{file.name}</span>
                    </p>
                    <p className="text-slate-400 text-xs">
                      {(file.size / 1024 / 1024).toFixed(2)} MB · Click to replace
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Paperclip className="w-6 h-6 mx-auto text-slate-400" />
                    <p className="text-slate-700 dark:text-slate-300 font-medium text-xs sm:text-sm">
                      Click to upload certificate document
                    </p>
                    <p className="text-slate-400 text-[11px]">
                      PDF, Word, or image formats (up to 10 MB)
                    </p>
                  </div>
                )}
              </div>
              {fileError && (
                <p className="text-rose-500 text-xs mt-1.5 font-medium">
                  {fileError}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-950/20 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs sm:text-sm font-semibold transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={
              uploading ||
              !form.name.trim() ||
              !form.issuingOrganization.trim() ||
              !form.issueDate
            }
            className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-semibold transition disabled:opacity-40 shadow-sm shadow-blue-500/20 cursor-pointer"
          >
            {uploading
              ? 'Saving…'
              : edit
              ? 'Save Changes'
              : 'Add Credential'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Training Card ────────────────────────────────────────────────────────────
function TrainingCard({
  t,
  canManage,
  onEdit,
  onDelete,
}: {
  t: TrainingDto;
  canManage: boolean;
  onEdit: (t: TrainingDto) => void;
  onDelete: (t: TrainingDto) => void;
}) {
  return (
    <Card className="border-slate-200/80 dark:border-slate-800 hover:border-blue-500/40 dark:hover:border-blue-500/40 transition-all flex flex-col justify-between shadow-sm hover:shadow-md">
      <CardContent className="p-5 space-y-3.5 flex-1 flex flex-col justify-between">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start gap-3">
            <span className="text-2xl mt-0.5 shrink-0">
              {TYPE_ICONS[t.trainingType] ?? '📚'}
            </span>
            <div className="flex-1 min-w-0">
              <h4 className="text-slate-900 dark:text-white font-bold text-sm leading-snug">
                {t.title}
              </h4>
              {t.provider && (
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5 font-medium">
                  {t.provider}
                </p>
              )}
            </div>
            <StatusBadge status={t.status} />
          </div>

          {/* Description */}
          {t.description && (
            <p className="text-slate-600 dark:text-slate-400 text-xs line-clamp-2 leading-relaxed">
              {t.description}
            </p>
          )}

          {/* Meta row */}
          <div className="flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-200/80 dark:border-slate-700 font-medium">
              <Calendar className="w-3 h-3 text-slate-400" />
              <span>
                {formatDate(t.startDate)}
                {t.endDate ? ` → ${formatDate(t.endDate)}` : ''}
              </span>
            </span>
            {t.durationHours > 0 && (
              <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-200/80 dark:border-slate-700 font-medium">
                <Clock className="w-3 h-3 text-blue-500" />
                <span>{t.durationHours} hrs</span>
              </span>
            )}
            <span className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-lg text-xs font-semibold">
              {t.trainingType}
            </span>
          </div>

          {/* Notes */}
          {t.notes && (
            <p className="text-slate-500 dark:text-slate-400 text-xs italic border-t border-slate-100 dark:border-slate-800 pt-2.5">
              "{t.notes}"
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          {t.courseUrl && (
            <a
              href={t.courseUrl}
              target="_blank"
              rel="noreferrer"
              className="flex-1 py-1.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold text-center transition flex items-center justify-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Course Link</span>
            </a>
          )}
          {canManage && (
            <>
              <button
                type="button"
                onClick={() => onEdit(t)}
                className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition cursor-pointer"
                title="Edit Course"
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onDelete(t)}
                className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 transition border border-rose-500/20 cursor-pointer"
                title="Delete Entry"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Certification Card ───────────────────────────────────────────────────────
function CertCard({
  c,
  canManage,
  currentUserId,
  onEdit,
  onDelete,
  onDownload,
}: {
  c: CertificationDto;
  canManage: boolean;
  currentUserId?: number;
  onEdit: (c: CertificationDto) => void;
  onDelete: (c: CertificationDto) => void;
  onDownload: (c: CertificationDto) => void;
}) {
  const expiryLabel = () => {
    if (!c.expiryDate)
      return (
        <span className="text-slate-500 dark:text-slate-400 text-xs">
          Lifetime / No Expiry
        </span>
      );
    if (c.isExpired)
      return (
        <span className="text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          <span>Expired {formatDate(c.expiryDate)}</span>
        </span>
      );
    if (c.expiresWithin30Days)
      return (
        <span className="text-amber-600 dark:text-amber-400 text-xs font-bold flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          <span>Expires in {c.daysUntilExpiry} days</span>
        </span>
      );
    return (
      <span className="text-slate-500 dark:text-slate-400 text-xs">
        Expires {formatDate(c.expiryDate)}
      </span>
    );
  };

  return (
    <Card
      className={`border transition-all flex flex-col justify-between shadow-sm hover:shadow-md ${
        c.isExpired
          ? 'border-rose-500/30'
          : c.expiresWithin30Days
          ? 'border-amber-500/30'
          : 'border-slate-200/80 dark:border-slate-800 hover:border-emerald-500/40'
      }`}
    >
      <CardContent className="p-5 space-y-3.5 flex-1 flex flex-col justify-between">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center flex-shrink-0">
              <Award className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-slate-900 dark:text-white font-bold text-sm leading-snug">
                {c.name}
              </h4>
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5 font-medium">
                {c.issuingOrganization}
              </p>
            </div>
            <StatusBadge status={c.status} />
          </div>

          {/* Dates & Expiry */}
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
            <span className="text-slate-500 dark:text-slate-400">
              🗓 Issued {formatDate(c.issueDate)}
            </span>
            <span>·</span>
            {expiryLabel()}
          </div>

          {/* Employee name (Team View) */}
          {c.userName && c.userId !== currentUserId && (
            <p className="text-slate-600 dark:text-slate-400 text-xs flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950/60 px-2.5 py-1 rounded-lg border border-slate-200/80 dark:border-slate-800">
              <User className="w-3.5 h-3.5 text-blue-500" />
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {c.userName}
              </span>
            </p>
          )}

          {/* Credential ID */}
          {c.credentialId && (
            <p className="text-slate-500 text-xs">
              ID: <span className="font-mono text-slate-800 dark:text-slate-300 font-semibold">{c.credentialId}</span>
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          {c.credentialUrl && (
            <a
              href={c.credentialUrl}
              target="_blank"
              rel="noreferrer"
              className="flex-1 py-1.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold text-center transition flex items-center justify-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Verify</span>
            </a>
          )}
          {c.hasFile && (
            <button
              type="button"
              onClick={() => onDownload(c)}
              className="flex-1 py-1.5 px-3 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-semibold transition border border-blue-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Certificate</span>
            </button>
          )}
          {canManage && (
            <>
              <button
                type="button"
                onClick={() => onEdit(c)}
                className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition cursor-pointer"
                title="Edit Credential"
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onDelete(c)}
                className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 transition border border-rose-500/20 cursor-pointer"
                title="Delete Credential"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Page Component ──────────────────────────────────────────────────────
export function TrainingCertificationPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const isManager = user?.role === 'Manager' || user?.role === 'TeamLead';

  const [mainTab, setMainTab] = useState<'trainings' | 'certifications'>('trainings');
  const [viewMode, setViewMode] = useState<'my' | 'all'>('my');
  const [statusFilter, setStatusFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [search, setSearch] = useState('');

  const [showAddTraining, setShowAddTraining] = useState(false);
  const [showAddCert, setShowAddCert] = useState(false);
  const [editTraining, setEditTraining] = useState<TrainingDto | null>(null);
  const [editCert, setEditCert] = useState<CertificationDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'training' | 'cert';
    item: any;
  } | null>(null);

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: myTrainings = [], isLoading: tLoad1 } = useQuery({
    queryKey: ['my-trainings'],
    queryFn: () => trainingApi.getMyTrainings().then((r) => r.data),
  });

  const { data: allTrainings = [], isLoading: tLoad2 } = useQuery({
    queryKey: ['all-trainings'],
    queryFn: () => trainingApi.getAllTrainings().then((r) => r.data),
    enabled: isManager && viewMode === 'all' && mainTab === 'trainings',
  });

  const { data: myCerts = [], isLoading: cLoad1 } = useQuery({
    queryKey: ['my-certs'],
    queryFn: () => trainingApi.getMyCertifications().then((r) => r.data),
  });

  const { data: allCerts = [], isLoading: cLoad2 } = useQuery({
    queryKey: ['all-certs'],
    queryFn: () => trainingApi.getAllCertifications().then((r) => r.data),
    enabled: isManager && viewMode === 'all' && mainTab === 'certifications',
  });

  const { data: myStats } = useQuery<TrainingStatsDto>({
    queryKey: ['training-stats'],
    queryFn: () => trainingApi.getMyStats().then((r) => r.data),
  });

  const { data: teamStats } = useQuery<TeamTrainingStatsDto>({
    queryKey: ['team-training-stats'],
    queryFn: () => trainingApi.getTeamStats().then((r) => r.data),
    enabled: isManager,
  });

  // ── Delete mutation ────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      if (!deleteTarget) return;
      if (deleteTarget.type === 'training') {
        await trainingApi.deleteTraining(deleteTarget.item.id);
      } else {
        await trainingApi.deleteCertification(deleteTarget.item.id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-trainings'] });
      qc.invalidateQueries({ queryKey: ['all-trainings'] });
      qc.invalidateQueries({ queryKey: ['my-certs'] });
      qc.invalidateQueries({ queryKey: ['all-certs'] });
      qc.invalidateQueries({ queryKey: ['training-stats'] });
      toast.success('Record successfully removed.');
      setDeleteTarget(null);
    },
    onError: () => toast.error('Failed to remove record.'),
  });

  // ── Download cert ──────────────────────────────────────────────────────────
  const handleDownloadCert = async (c: CertificationDto) => {
    try {
      const res = await trainingApi.downloadCert(c.id);
      const url = URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = c.fileName ?? `${c.name}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Certificate download failed.');
    }
  };

  // ── Filtering ──────────────────────────────────────────────────────────────
  const srcTrainings =
    isManager && viewMode === 'all' ? allTrainings : myTrainings;
  const srcCerts = isManager && viewMode === 'all' ? allCerts : myCerts;

  const filteredTrainings = srcTrainings.filter((t) => {
    const matchStatus = statusFilter === 'All' || t.status === statusFilter;
    const matchType = typeFilter === 'All' || t.trainingType === typeFilter;
    const matchSearch =
      !search ||
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      (t.provider ?? '').toLowerCase().includes(search.toLowerCase()) ||
      t.userName.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchType && matchSearch;
  });

  const filteredCerts = srcCerts.filter((c) => {
    const matchStatus = statusFilter === 'All' || c.status === statusFilter;
    const matchSearch =
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.issuingOrganization.toLowerCase().includes(search.toLowerCase()) ||
      c.userName.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const isLoading =
    mainTab === 'trainings'
      ? viewMode === 'all'
        ? tLoad2
        : tLoad1
      : viewMode === 'all'
      ? cLoad2
      : cLoad1;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* ── Page Header ── */}
      <PageHeader
        title="Professional Development & Credentials"
        description="Comprehensive management of continuous learning coursework, licensing certifications, skill benchmarks, and credential lifecycles."
        breadcrumbs={[
          { label: 'Workspace', href: '/' },
          { label: 'Growth & Learning' },
          { label: 'Trainings & Certifications' },
        ]}
        badge={{ label: 'Continuous Upskilling', variant: 'purple' }}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowAddTraining(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Record Training</span>
            </button>
            <button
              type="button"
              onClick={() => setShowAddCert(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-sm shadow-blue-500/20 transition cursor-pointer"
            >
              <Award className="w-4 h-4" />
              <span>Add Credential</span>
            </button>
          </div>
        }
      />

      {/* ── Personal Stats Cards ── */}
      {myStats && viewMode === 'my' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Completed Courses"
            value={String(myStats.completedTrainings)}
            subtitle="Verified programs finished"
            icon={CheckCircle2}
            color="emerald"
          />
          <StatCard
            title="Learning Hours"
            value={`${myStats.totalHours} hrs`}
            subtitle="Total development investment"
            icon={Clock}
            color="blue"
          />
          <StatCard
            title="Active Credentials"
            value={String(myStats.activeCertifications)}
            subtitle="Current verified licenses"
            icon={Award}
            color="purple"
          />
          <StatCard
            title="Expiring Soon"
            value={String(myStats.expiringWithin30Days)}
            subtitle="Expires within 30 days"
            icon={AlertTriangle}
            color="amber"
          />
        </div>
      )}

      {/* ── Team Stats Cards (Manager All View) ── */}
      {isManager && viewMode === 'all' && teamStats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatCard
            title="Team Members"
            value={String(teamStats.totalMembers)}
            subtitle="Tracked employees"
            icon={Users}
            color="blue"
          />
          <StatCard
            title="Total Courses"
            value={String(teamStats.totalTrainings)}
            subtitle="Active & completed"
            icon={BookOpen}
            color="purple"
          />
          <StatCard
            title="Certifications"
            value={String(teamStats.totalCertifications)}
            subtitle="Verified credentials"
            icon={Award}
            color="emerald"
          />
          <StatCard
            title="Expiring Certs"
            value={String(teamStats.expiringCerts)}
            subtitle="Action required"
            icon={AlertTriangle}
            color="amber"
          />
          <StatCard
            title="Total Hours"
            value={`${teamStats.totalHours}h`}
            subtitle="Cumulative training time"
            icon={Clock}
            color="blue"
          />
        </div>
      )}

      {/* ── Tabs & View Controls ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Main Tab */}
        <div className="flex gap-1.5 bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl border border-slate-200/80 dark:border-slate-800 w-fit">
          <button
            type="button"
            onClick={() => {
              setMainTab('trainings');
              setStatusFilter('All');
              setTypeFilter('All');
            }}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer ${
              mainTab === 'trainings'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            <span>Trainings & Courses</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMainTab('certifications');
              setStatusFilter('All');
            }}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer ${
              mainTab === 'certifications'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>Credentials & Licenses</span>
          </button>
        </div>

        {/* Manager Mode Toggle */}
        {isManager && (
          <div className="flex gap-1.5 bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl border border-slate-200/80 dark:border-slate-800 w-fit">
            <button
              type="button"
              onClick={() => setViewMode('my')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                viewMode === 'my'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>My Portfolio</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('all')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                viewMode === 'all'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Department Roster</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Filters & Search ── */}
      <div className="flex flex-wrap gap-2.5 items-center justify-between">
        <div className="flex flex-wrap gap-1.5 items-center">
          {(mainTab === 'trainings'
            ? ['All', ...TRAINING_STATUSES]
            : ['All', 'Active', 'Expired', 'Revoked']
          ).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-xl text-xs font-semibold transition cursor-pointer border ${
                statusFilter === s
                  ? 'bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-500/20'
                  : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {s}
            </button>
          ))}

          {mainTab === 'trainings' && (
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl px-2.5 py-1 text-slate-700 dark:text-slate-300 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 ml-1"
            >
              <option value="All">All Formats</option>
              {TRAINING_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_ICONS[t]} {t}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, provider, or person…"
            className="w-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* ── Content Grid ── */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl h-44 animate-pulse"
            />
          ))}
        </div>
      ) : mainTab === 'trainings' ? (
        filteredTrainings.length === 0 ? (
          <Card className="border-slate-200/80 dark:border-slate-800">
            <CardContent className="text-center py-20 text-slate-400 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-500 mx-auto flex items-center justify-center">
                <GraduationCap className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {search
                  ? 'No matching training programs found'
                  : 'No training records logged yet'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                {search
                  ? 'Try adjusting your search criteria or reset active filters.'
                  : 'Document your learning curriculum to demonstrate ongoing professional mastery.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTrainings.map((t) => (
              <TrainingCard
                key={t.id}
                t={t}
                canManage={isManager || t.userId === user?.id}
                onEdit={setEditTraining}
                onDelete={(item) =>
                  setDeleteTarget({ type: 'training', item })
                }
              />
            ))}
          </div>
        )
      ) : filteredCerts.length === 0 ? (
        <Card className="border-slate-200/80 dark:border-slate-800">
          <CardContent className="text-center py-20 text-slate-400 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 mx-auto flex items-center justify-center">
              <Award className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {search
                ? 'No matching credentials found'
                : 'No credentials recorded yet'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              {search
                ? 'Try adjusting your search criteria or reset active filters.'
                : 'Record your verified certifications to maintain compliance and professional standing.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCerts.map((c) => (
            <CertCard
              key={c.id}
              c={c}
              canManage={isManager || c.userId === user?.id}
              currentUserId={user?.id}
              onEdit={setEditCert}
              onDelete={(item) => setDeleteTarget({ type: 'cert', item })}
              onDownload={handleDownloadCert}
            />
          ))}
        </div>
      )}

      {/* ── Team Summary Leaderboard (Manager All View) ── */}
      {isManager &&
        viewMode === 'all' &&
        mainTab === 'trainings' &&
        teamStats &&
        teamStats.members.length > 0 && (
          <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden mt-6">
            <CardHeader className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-slate-800">
              <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-500" />
                <span>Department Learning & Certification Roster</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm">
                  <thead>
                    <tr className="text-left text-xs font-bold uppercase tracking-wider text-slate-500 bg-slate-50/50 dark:bg-slate-950/40 border-b border-slate-200/80 dark:border-slate-800">
                      <th className="py-3 px-4">Employee</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4 text-right">Total Courses</th>
                      <th className="py-3 px-4 text-right">Completed</th>
                      <th className="py-3 px-4 text-right">Hours Logged</th>
                      <th className="py-3 px-4 text-right">Certifications</th>
                      <th className="py-3 px-4 text-right">Expiring</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                    {teamStats.members.map((m) => (
                      <tr
                        key={m.userId}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition"
                      >
                        <td className="py-3 px-4 text-slate-900 dark:text-white font-bold">
                          {m.fullName}
                        </td>
                        <td className="py-3 px-4 text-slate-500 text-xs">
                          {m.role}
                        </td>
                        <td className="py-3 px-4 text-slate-700 dark:text-slate-300 text-right">
                          {m.trainingCount}
                        </td>
                        <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400 font-bold text-right">
                          {m.completedCount}
                        </td>
                        <td className="py-3 px-4 text-blue-600 dark:text-blue-400 font-bold text-right">
                          {m.hoursCompleted} hrs
                        </td>
                        <td className="py-3 px-4 text-amber-600 dark:text-amber-400 font-bold text-right">
                          {m.certificationCount}
                        </td>
                        <td
                          className={`py-3 px-4 text-right font-bold ${
                            m.expiringCertCount > 0
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-slate-400'
                          }`}
                        >
                          {m.expiringCertCount > 0
                            ? `⚠️ ${m.expiringCertCount}`
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

      {/* ── Modals ── */}
      {(showAddTraining || editTraining) && (
        <AddTrainingModal
          edit={editTraining ?? undefined}
          onClose={() => {
            setShowAddTraining(false);
            setEditTraining(null);
          }}
        />
      )}

      {(showAddCert || editCert) && (
        <AddCertModal
          edit={editCert ?? undefined}
          onClose={() => {
            setShowAddCert(false);
            setEditCert(null);
          }}
        />
      )}

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl space-y-4 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Delete{' '}
                {deleteTarget.type === 'training'
                  ? 'Training Program'
                  : 'Credential'}
                ?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                "
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {deleteTarget.item.title ?? deleteTarget.item.name}
                </span>
                " will be permanently deleted from your records.
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs sm:text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs sm:text-sm transition disabled:opacity-50 shadow-sm shadow-rose-500/20 cursor-pointer"
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

export default TrainingCertificationPage;