// ─────────────────────────────────────────────────────────────────────────────
//  FILE 9:  frontend/src/pages/TrainingCertificationPage.tsx
//  ACTION:  CREATE as a new file
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { trainingApi } from '../services/api';
import { useAuth } from '../context/Authcontext';
import { useToast } from '../context/ToastContext';
import type {
  TrainingDto, CertificationDto, TrainingStatsDto,
  TeamTrainingStatsDto, CreateTrainingDto, UpdateTrainingDto,
  CreateCertificationDto, UpdateCertificationDto,
} from '../types';

// ─── Constants ────────────────────────────────────────────────────────────────

const TRAINING_TYPES = ['Online', 'Internal', 'External', 'Conference', 'Workshop', 'Certification'];
const TRAINING_STATUSES = ['Planned', 'InProgress', 'Completed', 'Cancelled'];

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  Planned:    { label: 'Planned',     color: 'text-blue-400',   bg: 'bg-blue-500/20 border-blue-500/30'   },
  InProgress: { label: 'In Progress', color: 'text-yellow-400', bg: 'bg-yellow-500/20 border-yellow-500/30'},
  Completed:  { label: 'Completed',   color: 'text-green-400',  bg: 'bg-green-500/20 border-green-500/30'  },
  Cancelled:  { label: 'Cancelled',   color: 'text-slate-400',  bg: 'bg-slate-700 border-slate-600'        },
  Active:     { label: 'Active',      color: 'text-green-400',  bg: 'bg-green-500/20 border-green-500/30'  },
  Expired:    { label: 'Expired',     color: 'text-red-400',    bg: 'bg-red-500/20 border-red-500/30'      },
  Revoked:    { label: 'Revoked',     color: 'text-slate-400',  bg: 'bg-slate-700 border-slate-600'        },
};

const TYPE_ICONS: Record<string, string> = {
  Online: '💻', Internal: '🏢', External: '🌐',
  Conference: '🎤', Workshop: '🛠️', Certification: '🏆',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? STATUS_META.Planned;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${meta.bg} ${meta.color}`}>
      {meta.label}
    </span>
  );
}

// ─── Add Training Modal ───────────────────────────────────────────────────────

interface AddTrainingModalProps {
  edit?:    TrainingDto;
  onClose:  () => void;
}

function AddTrainingModal({ edit, onClose }: AddTrainingModalProps) {
  const qc    = useQueryClient();
  const { toast } = useToast();

  const [form, setForm] = useState<CreateTrainingDto>({
    title:         edit?.title         ?? '',
    provider:      edit?.provider      ?? '',
    trainingType:  edit?.trainingType  ?? 'Online',
    description:   edit?.description   ?? '',
    startDate:     edit?.startDate     ? edit.startDate.split('T')[0] : '',
    endDate:       edit?.endDate       ? edit.endDate.split('T')[0]   : '',
    durationHours: edit?.durationHours ?? 0,
    status:        edit?.status        ?? 'Planned',
    notes:         edit?.notes         ?? '',
    courseUrl:     edit?.courseUrl     ?? '',
  });

  const set = (k: keyof CreateTrainingDto, v: any) => setForm(f => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: () => edit
      ? trainingApi.updateTraining(edit.id, form as UpdateTrainingDto)
      : trainingApi.createTraining(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-trainings'] });
      qc.invalidateQueries({ queryKey: ['all-trainings'] });
      qc.invalidateQueries({ queryKey: ['training-stats'] });
      toast.success(edit ? 'Training updated.' : 'Training added 🎓');
      onClose();
    },
    onError: () => toast.error('Failed to save training.'),
  });

  const inputCls = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors';
  const labelCls = 'block text-slate-400 text-xs mb-1.5 font-medium';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="text-white font-semibold text-lg">{edit ? 'Edit Training' : 'Add Training'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl">✕</button>
        </div>

        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Title */}
          <div>
            <label className={labelCls}>Title *</label>
            <input value={form.title} onChange={e => set('title', e.target.value)}
              placeholder="e.g. AWS Cloud Practitioner" className={inputCls} />
          </div>

          {/* Provider + Type row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Provider</label>
              <input value={form.provider ?? ''} onChange={e => set('provider', e.target.value)}
                placeholder="Udemy, Coursera…" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Type</label>
              <select value={form.trainingType} onChange={e => set('trainingType', e.target.value)} className={inputCls}>
                {TRAINING_TYPES.map(t => (
                  <option key={t} value={t}>{TYPE_ICONS[t]} {t}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className={labelCls}>Description</label>
            <textarea value={form.description ?? ''} onChange={e => set('description', e.target.value)}
              rows={2} placeholder="What this training covers…" className={`${inputCls} resize-none`} />
          </div>

          {/* Dates row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Start Date *</label>
              <input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>End Date</label>
              <input type="date" value={form.endDate ?? ''} onChange={e => set('endDate', e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* Hours + Status row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Duration (hours)</label>
              <input type="number" min="0" step="0.5" value={form.durationHours}
                onChange={e => set('durationHours', parseFloat(e.target.value) || 0)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} className={inputCls}>
                {TRAINING_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Course URL */}
          <div>
            <label className={labelCls}>Course URL</label>
            <input value={form.courseUrl ?? ''} onChange={e => set('courseUrl', e.target.value)}
              placeholder="https://…" className={inputCls} />
          </div>

          {/* Notes */}
          <div>
            <label className={labelCls}>Notes</label>
            <textarea value={form.notes ?? ''} onChange={e => set('notes', e.target.value)}
              rows={2} placeholder="Key learnings, comments…" className={`${inputCls} resize-none`} />
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-slate-700">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800 text-sm font-medium transition-colors">
            Cancel
          </button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.title.trim() || !form.startDate}
            className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-40">
            {mutation.isPending ? 'Saving…' : edit ? 'Save Changes' : '+ Add Training'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Certification Modal ──────────────────────────────────────────────────

interface AddCertModalProps {
  edit?:   CertificationDto;
  onClose: () => void;
}

function AddCertModal({ edit, onClose }: AddCertModalProps) {
  const qc    = useQueryClient();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<CreateCertificationDto>({
    name:                edit?.name                ?? '',
    issuingOrganization: edit?.issuingOrganization ?? '',
    issueDate:           edit?.issueDate           ? edit.issueDate.split('T')[0]  : '',
    expiryDate:          edit?.expiryDate          ? edit.expiryDate.split('T')[0] : '',
    credentialId:        edit?.credentialId        ?? '',
    credentialUrl:       edit?.credentialUrl       ?? '',
  });
  const [file,      setFile]      = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const [uploading, setUploading] = useState(false);

  const set = (k: keyof CreateCertificationDto, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileError('');
    const allowed = ['application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg', 'image/png', 'image/webp'];
    if (f.size > 10 * 1024 * 1024) { setFileError('Max file size is 10 MB.'); return; }
    if (!allowed.includes(f.type))  { setFileError('Allowed: PDF, Word, Images.'); return; }
    setFile(f);
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.issuingOrganization.trim() || !form.issueDate) {
      toast.error('Name, Organization, and Issue Date are required.'); return;
    }

    setUploading(true);
    try {
      if (edit) {
        const upd: UpdateCertificationDto = {
          name: form.name, issuingOrganization: form.issuingOrganization,
          issueDate: form.issueDate ? new Date(form.issueDate).toISOString() : undefined,
          expiryDate: form.expiryDate ? new Date(form.expiryDate).toISOString() : undefined,
          credentialId: form.credentialId, credentialUrl: form.credentialUrl,
        };
        await trainingApi.updateCertification(edit.id, upd);
      } else {
        const fd = new FormData();
        fd.append('name',                form.name);
        fd.append('issuingOrganization', form.issuingOrganization);
        fd.append('issueDate',           new Date(form.issueDate).toISOString());
        if (form.expiryDate)    fd.append('expiryDate',    new Date(form.expiryDate).toISOString());
        if (form.credentialId)  fd.append('credentialId',  form.credentialId);
        if (form.credentialUrl) fd.append('credentialUrl', form.credentialUrl);
        if (file)               fd.append('File',          file);
        await trainingApi.createCertification(fd);
      }
      qc.invalidateQueries({ queryKey: ['my-certs'] });
      qc.invalidateQueries({ queryKey: ['all-certs'] });
      qc.invalidateQueries({ queryKey: ['training-stats'] });
      toast.success(edit ? 'Certification updated.' : 'Certification added 🏆');
      onClose();
    } catch {
      toast.error('Failed to save certification.');
    } finally {
      setUploading(false);
    }
  };

  const inputCls = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors';
  const labelCls = 'block text-slate-400 text-xs mb-1.5 font-medium';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="text-white font-semibold text-lg">{edit ? 'Edit Certification' : 'Add Certification'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl">✕</button>
        </div>

        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Name */}
          <div>
            <label className={labelCls}>Certification Name *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)}
              placeholder="e.g. AWS Solutions Architect" className={inputCls} />
          </div>

          {/* Organization */}
          <div>
            <label className={labelCls}>Issuing Organization *</label>
            <input value={form.issuingOrganization} onChange={e => set('issuingOrganization', e.target.value)}
              placeholder="e.g. Amazon Web Services" className={inputCls} />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Issue Date *</label>
              <input type="date" value={form.issueDate} onChange={e => set('issueDate', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Expiry Date</label>
              <input type="date" value={form.expiryDate ?? ''} onChange={e => set('expiryDate', e.target.value)} className={inputCls} />
              <p className="text-slate-500 text-xs mt-1">Leave empty if it never expires</p>
            </div>
          </div>

          {/* Credential ID + URL */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Credential ID</label>
              <input value={form.credentialId ?? ''} onChange={e => set('credentialId', e.target.value)}
                placeholder="e.g. ABC-12345" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Verify URL</label>
              <input value={form.credentialUrl ?? ''} onChange={e => set('credentialUrl', e.target.value)}
                placeholder="https://…" className={inputCls} />
            </div>
          </div>

          {/* File upload — only for new certs */}
          {!edit && (
            <div>
              <label className={labelCls}>Certificate File (optional)</label>
              <div
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
                  file ? 'border-blue-500 bg-blue-500/10' : 'border-slate-600 hover:border-slate-500 bg-slate-800/50'
                }`}
              >
                <input ref={fileRef} type="file" className="hidden"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                  onChange={handleFileChange} />
                {file ? (
                  <div className="space-y-1">
                    <p className="text-blue-400 font-medium text-sm">📎 {file.name}</p>
                    <p className="text-slate-400 text-xs">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-slate-300 text-sm">Click to attach certificate</p>
                    <p className="text-slate-500 text-xs">PDF, Word, Images · Max 10 MB</p>
                  </div>
                )}
              </div>
              {fileError && <p className="text-red-400 text-xs mt-1">{fileError}</p>}
            </div>
          )}
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-slate-700">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800 text-sm font-medium transition-colors">
            Cancel
          </button>
          <button onClick={handleSubmit}
            disabled={uploading || !form.name.trim() || !form.issuingOrganization.trim() || !form.issueDate}
            className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-40">
            {uploading ? 'Saving…' : edit ? 'Save Changes' : '+ Add Certification'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Training Card ────────────────────────────────────────────────────────────

function TrainingCard({ t, canManage, onEdit, onDelete }: {
  t: TrainingDto; canManage: boolean;
  onEdit: (t: TrainingDto) => void; onDelete: (t: TrainingDto) => void;
}) {
  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 flex flex-col gap-3 hover:bg-slate-800 transition-colors">
      {/* Header */}
      <div className="flex items-start gap-3">
        <span className="text-2xl mt-0.5 shrink-0">{TYPE_ICONS[t.trainingType] ?? '📚'}</span>
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium text-sm leading-tight">{t.title}</p>
          {t.provider && <p className="text-slate-400 text-xs mt-0.5">{t.provider}</p>}
        </div>
        <StatusBadge status={t.status} />
      </div>

      {/* Description */}
      {t.description && (
        <p className="text-slate-400 text-xs line-clamp-2">{t.description}</p>
      )}

      {/* Meta row */}
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
        <span>📅 {formatDate(t.startDate)}{t.endDate ? ` → ${formatDate(t.endDate)}` : ''}</span>
        {t.durationHours > 0 && <span>⏱ {t.durationHours}h</span>}
        <span className="bg-slate-700 px-2 py-0.5 rounded-full text-slate-300">{t.trainingType}</span>
      </div>

      {/* Notes */}
      {t.notes && (
        <p className="text-slate-500 text-xs italic border-t border-slate-700 pt-2">{t.notes}</p>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        {t.courseUrl && (
          <a href={t.courseUrl} target="_blank" rel="noreferrer"
            className="flex-1 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium text-center transition-colors">
            🔗 Open Course
          </a>
        )}
        {canManage && (
          <>
            <button onClick={() => onEdit(t)}
              className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs transition-colors">
              ✏️
            </button>
            <button onClick={() => onDelete(t)}
              className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/40 text-red-400 text-xs transition-colors border border-red-500/20">
              🗑
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Certification Card ───────────────────────────────────────────────────────

function CertCard({ c, canManage, currentUserId, onEdit, onDelete, onDownload }: {
  c: CertificationDto; canManage: boolean; currentUserId?: number;
  onEdit: (c: CertificationDto) => void;
  onDelete: (c: CertificationDto) => void;
  onDownload: (c: CertificationDto) => void;
}) {
  const expiryLabel = () => {
    if (!c.expiryDate) return <span className="text-slate-400 text-xs">No expiry</span>;
    if (c.isExpired)    return <span className="text-red-400 text-xs font-medium">⛔ Expired {formatDate(c.expiryDate)}</span>;
    if (c.expiresWithin30Days)
      return <span className="text-yellow-400 text-xs font-medium">⚠️ Expires in {c.daysUntilExpiry}d</span>;
    return <span className="text-slate-400 text-xs">Expires {formatDate(c.expiryDate)}</span>;
  };

  return (
    <div className={`bg-slate-800/60 border rounded-xl p-4 flex flex-col gap-3 hover:bg-slate-800 transition-colors ${
      c.isExpired ? 'border-red-500/40' : c.expiresWithin30Days ? 'border-yellow-500/40' : 'border-slate-700'
    }`}>
      {/* Header */}
      <div className="flex items-start gap-3">
        <span className="text-2xl mt-0.5 shrink-0">🏆</span>
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium text-sm leading-tight">{c.name}</p>
          <p className="text-slate-400 text-xs mt-0.5">{c.issuingOrganization}</p>
        </div>
        <StatusBadge status={c.status} />
      </div>

      {/* Dates */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
        <span className="text-slate-500">🗓 Issued {formatDate(c.issueDate)}</span>
        {expiryLabel()}
      </div>

      {/* Employee name — shown in manager team view */}
      {c.userName && c.userId !== currentUserId && (
        <p className="text-slate-500 text-xs flex items-center gap-1">
          👤 <span className="text-slate-300 font-medium">{c.userName}</span>
        </p>
      )}

      {/* Credential ID */}
      {c.credentialId && (
        <p className="text-slate-500 text-xs">
          🪪 Credential ID: <span className="text-slate-300 font-mono">{c.credentialId}</span>
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        {c.credentialUrl && (
          <a href={c.credentialUrl} target="_blank" rel="noreferrer"
            className="flex-1 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium text-center transition-colors">
            🔗 Verify
          </a>
        )}
        {c.hasFile && (
          <button onClick={() => onDownload(c)}
            className="flex-1 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 text-xs font-medium transition-colors border border-blue-500/30">
            ⬇ Download
          </button>
        )}
        {canManage && (
          <>
            <button onClick={() => onEdit(c)}
              className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs transition-colors">
              ✏️
            </button>
            <button onClick={() => onDelete(c)}
              className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/40 text-red-400 text-xs transition-colors border border-red-500/20">
              🗑
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function TrainingCertificationPage() {
  const { user }  = useAuth();
  const { toast } = useToast();
  const qc        = useQueryClient();

  const isManager = user?.role === 'Manager' || user?.role === 'TeamLead';

  const [mainTab,   setMainTab]   = useState<'trainings' | 'certifications'>('trainings');
  const [viewMode,  setViewMode]  = useState<'my' | 'all'>('my');
  const [statusFilter, setStatusFilter] = useState('All');
  const [typeFilter,   setTypeFilter]   = useState('All');
  const [search,    setSearch]    = useState('');

  const [showAddTraining, setShowAddTraining] = useState(false);
  const [showAddCert,     setShowAddCert]     = useState(false);
  const [editTraining,    setEditTraining]    = useState<TrainingDto | null>(null);
  const [editCert,        setEditCert]        = useState<CertificationDto | null>(null);
  const [deleteTarget,    setDeleteTarget]    = useState<{ type: 'training' | 'cert'; item: any } | null>(null);

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: myTrainings  = [], isLoading: tLoad1 } = useQuery({
    queryKey: ['my-trainings'],
    queryFn:  () => trainingApi.getMyTrainings().then(r => r.data),
  });

  const { data: allTrainings = [], isLoading: tLoad2 } = useQuery({
    queryKey: ['all-trainings'],
    queryFn:  () => trainingApi.getAllTrainings().then(r => r.data),
    enabled:  isManager && viewMode === 'all' && mainTab === 'trainings',
  });

  const { data: myCerts     = [], isLoading: cLoad1 } = useQuery({
    queryKey: ['my-certs'],
    queryFn:  () => trainingApi.getMyCertifications().then(r => r.data),
  });

  const { data: allCerts    = [], isLoading: cLoad2 } = useQuery({
    queryKey: ['all-certs'],
    queryFn:  () => trainingApi.getAllCertifications().then(r => r.data),
    enabled:  isManager && viewMode === 'all' && mainTab === 'certifications',
  });

  const { data: myStats }    = useQuery<TrainingStatsDto>({
    queryKey: ['training-stats'],
    queryFn:  () => trainingApi.getMyStats().then(r => r.data),
  });

  const { data: teamStats }  = useQuery<TeamTrainingStatsDto>({
    queryKey: ['team-training-stats'],
    queryFn:  () => trainingApi.getTeamStats().then(r => r.data),
    enabled:  isManager,
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
      toast.success('Deleted successfully.');
      setDeleteTarget(null);
    },
    onError: () => toast.error('Delete failed.'),
  });

  // ── Download cert ──────────────────────────────────────────────────────────
  const handleDownloadCert = async (c: CertificationDto) => {
    try {
      const res  = await trainingApi.downloadCert(c.id);
      const url  = URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href     = url;
      link.download = c.fileName ?? `${c.name}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Download failed.');
    }
  };

  // ── Filtering ──────────────────────────────────────────────────────────────
  const srcTrainings = isManager && viewMode === 'all' ? allTrainings : myTrainings;
  const srcCerts     = isManager && viewMode === 'all' ? allCerts     : myCerts;

  const filteredTrainings = srcTrainings.filter(t => {
    const matchStatus = statusFilter === 'All' || t.status === statusFilter;
    const matchType   = typeFilter   === 'All' || t.trainingType === typeFilter;
    const matchSearch = !search ||
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      (t.provider ?? '').toLowerCase().includes(search.toLowerCase()) ||
      t.userName.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchType && matchSearch;
  });

  const filteredCerts = srcCerts.filter(c => {
    const matchStatus = statusFilter === 'All' || c.status === statusFilter;
    const matchSearch = !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.issuingOrganization.toLowerCase().includes(search.toLowerCase()) ||
      c.userName.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const isLoading = mainTab === 'trainings'
    ? (viewMode === 'all' ? tLoad2 : tLoad1)
    : (viewMode === 'all' ? cLoad2 : cLoad1);

  const stats = isManager && viewMode === 'all' ? null : myStats;

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">🎓 Training & Certifications</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {isManager ? 'Track your team\'s learning and credentials' : 'Track your learning progress and credentials'}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAddTraining(true)}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl text-sm font-medium transition-colors">
            + Training
          </button>
          <button onClick={() => setShowAddCert(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition-colors shadow-lg shadow-blue-600/20">
            + Certification
          </button>
        </div>
      </div>

      {/* ── My Stats Cards ───────────────────────────────────────────────────── */}
      {myStats && viewMode === 'my' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Completed',      value: myStats.completedTrainings,   icon: '✅', color: 'text-green-400'  },
            { label: 'Hours Trained',  value: `${myStats.totalHours}h`,     icon: '⏱',  color: 'text-blue-400'   },
            { label: 'Certifications', value: myStats.activeCertifications, icon: '🏆', color: 'text-yellow-400' },
            { label: 'Expiring Soon',  value: myStats.expiringWithin30Days, icon: '⚠️', color: 'text-orange-400'  },
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

      {/* ── Team Stats (Manager, All view) ───────────────────────────────────── */}
      {isManager && viewMode === 'all' && teamStats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {[
            { label: 'Members',        value: teamStats.totalMembers,        icon: '👥', color: 'text-slate-300'  },
            { label: 'Total Trainings',value: teamStats.totalTrainings,      icon: '📚', color: 'text-blue-400'   },
            { label: 'Certifications', value: teamStats.totalCertifications, icon: '🏆', color: 'text-yellow-400' },
            { label: 'Expiring Certs', value: teamStats.expiringCerts,       icon: '⚠️', color: 'text-orange-400' },
            { label: 'Total Hours',    value: `${teamStats.totalHours}h`,    icon: '⏱',  color: 'text-green-400'  },
          ].map(s => (
            <div key={s.label} className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex items-center gap-3">
              <span className="text-xl">{s.icon}</span>
              <div>
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-slate-400 text-xs">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Tabs + View Toggle ───────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Main tabs */}
        <div className="flex gap-1 bg-slate-800/50 rounded-xl p-1">
          {([['trainings', '📚 Trainings'], ['certifications', '🏆 Certifications']] as const).map(([tab, label]) => (
            <button key={tab} onClick={() => { setMainTab(tab); setStatusFilter('All'); setTypeFilter('All'); }}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                mainTab === tab ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* Manager view toggle */}
        {isManager && (
          <div className="flex gap-1 bg-slate-800/50 rounded-xl p-1 ml-auto">
            {(['my', 'all'] as const).map(v => (
              <button key={v} onClick={() => setViewMode(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  viewMode === v ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}>
                {v === 'my' ? '👤 Mine' : '👥 Team'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Filters ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Status filter */}
        <div className="flex gap-1.5">
          {(mainTab === 'trainings'
            ? ['All', ...TRAINING_STATUSES]
            : ['All', 'Active', 'Expired', 'Revoked']
          ).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                statusFilter === s
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
              }`}>
              {s}
            </button>
          ))}
        </div>

        {/* Type filter — only for trainings */}
        {mainTab === 'trainings' && (
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-300 text-xs focus:outline-none focus:border-blue-500">
            <option value="All">All Types</option>
            {TRAINING_TYPES.map(t => <option key={t} value={t}>{TYPE_ICONS[t]} {t}</option>)}
          </select>
        )}

        {/* Search */}
        <div className="relative ml-auto">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
            className="bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors w-48" />
        </div>
      </div>

      {/* ── Content Grid ─────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-slate-800 border border-slate-700 rounded-xl p-4 h-40 animate-pulse" />
          ))}
        </div>
      ) : mainTab === 'trainings' ? (
        filteredTrainings.length === 0 ? (
          <EmptyState msg={search ? 'No trainings match your search.' : 'No trainings yet. Add your first!'} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTrainings.map(t => (
              <TrainingCard key={t.id} t={t}
                canManage={isManager || t.userId === user?.id}
                onEdit={setEditTraining}
                onDelete={item => setDeleteTarget({ type: 'training', item })} />
            ))}
          </div>
        )
      ) : (
        filteredCerts.length === 0 ? (
          <EmptyState msg={search ? 'No certifications match your search.' : 'No certifications yet. Add your first!'} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCerts.map(c => (
              <CertCard key={c.id} c={c}
                canManage={isManager || c.userId === user?.id}
                currentUserId={user?.id}       // ← ADD THIS
                onEdit={setEditCert}
                onDelete={item => setDeleteTarget({ type: 'cert', item })}
                onDownload={handleDownloadCert} />
            ))}
          </div>
        )
      )}

      {/* Team leaderboard — manager all view, trainings tab */}
      {isManager && viewMode === 'all' && mainTab === 'trainings' && teamStats && teamStats.members.length > 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4">📊 Team Learning Summary</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 border-b border-slate-700">
                  <th className="pb-2 pr-4">Employee</th>
                  <th className="pb-2 pr-4">Role</th>
                  <th className="pb-2 pr-4 text-right">Trainings</th>
                  <th className="pb-2 pr-4 text-right">Completed</th>
                  <th className="pb-2 pr-4 text-right">Hours</th>
                  <th className="pb-2 pr-4 text-right">Certs</th>
                  <th className="pb-2 text-right">Expiring</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {teamStats.members.map(m => (
                  <tr key={m.userId} className="hover:bg-slate-700/30 transition-colors">
                    <td className="py-2.5 pr-4 text-white font-medium">{m.fullName}</td>
                    <td className="py-2.5 pr-4 text-slate-400 text-xs">{m.role}</td>
                    <td className="py-2.5 pr-4 text-slate-300 text-right">{m.trainingCount}</td>
                    <td className="py-2.5 pr-4 text-green-400 text-right">{m.completedCount}</td>
                    <td className="py-2.5 pr-4 text-blue-400 text-right">{m.hoursCompleted}h</td>
                    <td className="py-2.5 pr-4 text-yellow-400 text-right">{m.certificationCount}</td>
                    <td className={`py-2.5 text-right font-medium ${m.expiringCertCount > 0 ? 'text-orange-400' : 'text-slate-500'}`}>
                      {m.expiringCertCount > 0 ? `⚠️ ${m.expiringCertCount}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modals ───────────────────────────────────────────────────────────── */}
      {(showAddTraining || editTraining) && (
        <AddTrainingModal
          edit={editTraining ?? undefined}
          onClose={() => { setShowAddTraining(false); setEditTraining(null); }} />
      )}
      {(showAddCert || editCert) && (
        <AddCertModal
          edit={editCert ?? undefined}
          onClose={() => { setShowAddCert(false); setEditCert(null); }} />
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4">
            <div className="text-center space-y-2">
              <div className="text-4xl">🗑️</div>
              <h3 className="text-white font-semibold text-lg">Delete {deleteTarget.type === 'training' ? 'Training' : 'Certification'}?</h3>
              <p className="text-slate-400 text-sm">
                "<span className="text-white">{deleteTarget.item.title ?? deleteTarget.item.name}</span>" will be permanently removed.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800 text-sm font-medium transition-colors">
                Cancel
              </button>
              <button onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}
                className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors disabled:opacity-50">
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function EmptyState({ msg }: { msg: string }) {
  return (
    <div className="text-center py-16 text-slate-500">
      <div className="text-5xl mb-3">📭</div>
      <p className="text-slate-400 font-medium">{msg}</p>
    </div>
  );
}