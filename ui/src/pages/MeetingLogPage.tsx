import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { managerApi, meetingApi } from '../services/api';
import { useAuth } from '../context/Authcontext';
import { useToast } from '../context/ToastContext';
import type {
  MeetingDto,
  MeetingActionItemDto,
  CreateMeetingDto,
  MeetingType,
  MeetingStatus,
  RsvpResponse,
} from '../types';
import { DatePicker } from '../components/DatePicker';
import { DateTimePicker } from '../components/DateTimePicker';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Card, CardContent } from '../components/ui/Card';
import {
  Calendar,
  Clock,
  MapPin,
  CheckSquare,
  AlertCircle,
  Plus,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  CheckCircle2} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────
const BACKEND_ORIGIN = 'https://localhost:7096';

const MEETING_TYPES: { value: MeetingType; label: string; icon: string }[] = [
  { value: 'StandUp', label: 'Daily Stand-Up', icon: '☀️' },
  { value: 'Planning', label: 'Sprint Planning', icon: '📋' },
  { value: 'Review', label: 'Sprint Review / Demo', icon: '🔍' },
  { value: 'Retrospective', label: 'Retrospective', icon: '🔄' },
  { value: 'OneOnOne', label: '1-on-1 Catchup', icon: '👤' },
  { value: 'Other', label: 'General Sync', icon: '📅' },
];

const STATUS_CFG: Record<
  MeetingStatus,
  { label: string; text: string; bg: string; border: string; dot: string }
> = {
  Scheduled: {
    label: 'Scheduled',
    text: 'text-blue-700 dark:text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/25',
    dot: 'bg-blue-500',
  },
  InProgress: {
    label: 'In Progress',
    text: 'text-amber-700 dark:text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/25',
    dot: 'bg-amber-500 animate-pulse',
  },
  Completed: {
    label: 'Completed',
    text: 'text-emerald-700 dark:text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/25',
    dot: 'bg-emerald-500',
  },
  Cancelled: {
    label: 'Cancelled',
    text: 'text-slate-600 dark:text-slate-400',
    bg: 'bg-slate-100 dark:bg-slate-800',
    border: 'border-slate-200 dark:border-slate-700',
    dot: 'bg-slate-400',
  },
};

const RSVP_CFG: Record<
  RsvpResponse,
  { label: string; text: string; bg: string; border: string }
> = {
  Accepted: {
    label: 'Accepted',
    text: 'text-emerald-700 dark:text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/25',
  },
  Pending: {
    label: 'Pending',
    text: 'text-amber-700 dark:text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/25',
  },
  Declined: {
    label: 'Declined',
    text: 'text-rose-700 dark:text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/25',
  },
  Maybe: {
    label: 'Tentative',
    text: 'text-slate-700 dark:text-slate-300',
    bg: 'bg-slate-100 dark:bg-slate-800',
    border: 'border-slate-200 dark:border-slate-700',
  },
};

// ─── Small Helpers ────────────────────────────────────────────────────────────
const Avatar: React.FC<{
  src?: string | null;
  name: string;
  size?: 'xs' | 'sm' | 'md';
}> = ({ src, name, size = 'sm' }) => {
  const sizeMap = {
    xs: 'w-5 h-5 text-[9px]',
    sm: 'w-7 h-7 text-xs font-semibold',
    md: 'w-9 h-9 text-sm font-bold',
  };
  const initials = name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const resolved = src
    ? src.startsWith('http')
      ? src
      : `${BACKEND_ORIGIN}${src}`
    : null;

  if (resolved) {
    return (
      <img
        src={resolved}
        alt={name}
        className={`${sizeMap[size]} rounded-full object-cover flex-shrink-0 shadow-sm`}
      />
    );
  }
  return (
    <div
      className={`${sizeMap[size]} rounded-full bg-gradient-to-br from-blue-500 to-indigo-600
      flex items-center justify-center font-bold text-white flex-shrink-0 shadow-sm`}
    >
      {initials || 'U'}
    </div>
  );
};

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  });
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

const getMeetingTypeCfg = (type: MeetingType) =>
  MEETING_TYPES.find((t) => t.value === type) ??
  MEETING_TYPES[MEETING_TYPES.length - 1];

// ─── Action Item Row ──────────────────────────────────────────────────────────
const ActionItemRow: React.FC<{
  item: MeetingActionItemDto;
  canEdit: boolean;
  meetingId: number;
}> = ({ item, canEdit }) => {
  const { toast } = useToast();
  const qc = useQueryClient();

  const updateMut = useMutation({
    mutationFn: (d: object) => meetingApi.updateActionItem(item.id, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meetings'] });
      toast.success('Action item status updated');
    },
    onError: () => toast.error('Failed to update action item'),
  });

  const deleteMut = useMutation({
    mutationFn: () => meetingApi.deleteActionItem(item.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meetings'] });
      toast.success('Action item removed');
    },
    onError: () => toast.error('Failed to delete action item'),
  });

  const statusMeta: Record<
    string,
    { label: string; bg: string; text: string; border: string; dot: string }
  > = {
    Open: {
      label: 'Open',
      bg: 'bg-amber-500/10',
      text: 'text-amber-700 dark:text-amber-400',
      border: 'border-amber-500/25',
      dot: 'bg-amber-500',
    },
    InProgress: {
      label: 'In Progress',
      bg: 'bg-blue-500/10',
      text: 'text-blue-700 dark:text-blue-400',
      border: 'border-blue-500/25',
      dot: 'bg-blue-500',
    },
    Done: {
      label: 'Completed',
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-700 dark:text-emerald-400',
      border: 'border-emerald-500/25',
      dot: 'bg-emerald-500',
    },
  };

  const meta = statusMeta[item.status] ?? statusMeta.Open;

  return (
    <div
      className={`flex items-start gap-3 p-3.5 rounded-2xl border transition-all ${
        item.status === 'Done'
          ? 'bg-slate-50/50 dark:bg-slate-950/20 border-slate-200/60 dark:border-slate-800/60 opacity-70'
          : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 shadow-sm'
      }`}
    >
      {/* Clickable Status Indicator */}
      {canEdit ? (
        <button
          type="button"
          title="Click to cycle status: Open → In Progress → Completed"
          onClick={() => {
            const next =
              item.status === 'Open'
                ? 'InProgress'
                : item.status === 'InProgress'
                ? 'Done'
                : 'Open';
            updateMut.mutate({ status: next });
          }}
          className={`w-4 h-4 rounded-md mt-0.5 flex items-center justify-center border flex-shrink-0 cursor-pointer transition hover:scale-110 ${
            item.status === 'Done'
              ? 'bg-emerald-600 border-emerald-600 text-white'
              : 'border-slate-300 dark:border-slate-600 hover:border-blue-500'
          }`}
        >
          {item.status === 'Done' && <CheckCircle2 className="w-3.5 h-3.5" />}
        </button>
      ) : (
        <span
          className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${meta.dot}`}
        />
      )}

      <div className="flex-1 min-w-0">
        <p
          className={`text-xs sm:text-sm font-semibold leading-snug ${
            item.status === 'Done'
              ? 'line-through text-slate-400 dark:text-slate-500'
              : 'text-slate-900 dark:text-white'
          }`}
        >
          {item.description}
        </p>

        <div className="flex flex-wrap items-center gap-2.5 mt-1.5 text-xs text-slate-500 dark:text-slate-400">
          {item.assignedToUserName && (
            <span className="inline-flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
              <span className="text-slate-400">Owner:</span>
              <span>{item.assignedToUserName}</span>
            </span>
          )}
          {item.dueDate && (
            <span className="inline-flex items-center gap-1 text-[11px]">
              <Calendar className="w-3 h-3 text-slate-400" />
              <span>Due {formatDate(item.dueDate)}</span>
            </span>
          )}
          <span
            className={`text-[10px] px-2 py-0.5 rounded-md border font-bold uppercase tracking-wider ${meta.bg} ${meta.border} ${meta.text}`}
          >
            {meta.label}
          </span>
        </div>
      </div>

      {canEdit && (
        <button
          type="button"
          onClick={() => deleteMut.mutate()}
          className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition p-1 cursor-pointer flex-shrink-0"
          title="Delete action item"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

// ─── Meeting Detail Modal ─────────────────────────────────────────────────────
const MeetingModal: React.FC<{
  meeting: MeetingDto;
  allUsers: { id: number; fullName: string }[];
  onClose: () => void;
}> = ({ meeting, onClose }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [tab, setTab] = useState<'details' | 'attendees' | 'actions'>('details');
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState(meeting.notes ?? '');
  const [newActionDesc, setNewActionDesc] = useState('');
  const [newActionAssignee, setNewActionAssignee] = useState<number | ''>('');
  const [newActionDue, setNewActionDue] = useState('');

  const cfg = STATUS_CFG[meeting.status];
  const typeCfg = getMeetingTypeCfg(meeting.meetingType);

  const rsvpMut = useMutation({
    mutationFn: (response: string) => meetingApi.rsvp(meeting.id, response),
    onSuccess: () => {
      toast.success('RSVP status updated');
      qc.invalidateQueries({ queryKey: ['meetings'] });
    },
    onError: () => toast.error('Failed to update RSVP status'),
  });

  const updateMut = useMutation({
    mutationFn: (d: object) => meetingApi.update(meeting.id, d),
    onSuccess: () => {
      toast.success('Meeting notes saved');
      qc.invalidateQueries({ queryKey: ['meetings'] });
      setEditingNotes(false);
    },
    onError: () => toast.error('Failed to save notes'),
  });

  const addActionMut = useMutation({
    mutationFn: (d: object) => meetingApi.addActionItem(meeting.id, d),
    onSuccess: () => {
      toast.success('Action item assigned');
      qc.invalidateQueries({ queryKey: ['meetings'] });
      setNewActionDesc('');
      setNewActionAssignee('');
      setNewActionDue('');
    },
    onError: () => toast.error('Failed to add action item'),
  });

  const statusMut = useMutation({
    mutationFn: (status: string) => meetingApi.update(meeting.id, { status }),
    onSuccess: () => {
      toast.success('Meeting status updated');
      qc.invalidateQueries({ queryKey: ['meetings'] });
    },
    onError: () => toast.error('Failed to update status'),
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex-shrink-0">
          <div className="flex items-start justify-between gap-3.5">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="text-base">{typeCfg.icon}</span>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {typeCfg.label}
                </span>
                <span
                  className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${cfg.bg} ${cfg.border} ${cfg.text}`}
                >
                  {cfg.label}
                </span>
                {meeting.myResponse && !meeting.isOrganiser && (
                  <span
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${RSVP_CFG[meeting.myResponse].bg} ${RSVP_CFG[meeting.myResponse].border} ${RSVP_CFG[meeting.myResponse].text}`}
                  >
                    RSVP: {RSVP_CFG[meeting.myResponse].label}
                  </span>
                )}
              </div>

              <h2 className="text-slate-900 dark:text-white font-bold text-lg sm:text-xl leading-tight">
                {meeting.title}
              </h2>

              <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1 font-medium">
                  <Clock className="w-3.5 h-3.5 text-blue-500" />
                  <span>{formatDateTime(meeting.scheduledAt)}</span>
                </span>
                <span>·</span>
                <span>{meeting.durationMinutes} minutes duration</span>
                {meeting.location && (
                  <>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1 text-slate-700 dark:text-slate-300 font-medium truncate max-w-xs">
                      <MapPin className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
                      <span>{meeting.location}</span>
                    </span>
                  </>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition cursor-pointer flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Quick RSVP Bar for Invitees */}
          {!meeting.isOrganiser && meeting.status === 'Scheduled' && (
            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-200/80 dark:border-slate-800">
              <span className="text-xs font-semibold text-slate-500">Your RSVP:</span>
              {(['Accepted', 'Maybe', 'Declined'] as RsvpResponse[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => rsvpMut.mutate(r)}
                  disabled={rsvpMut.isPending}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold transition border cursor-pointer ${
                    meeting.myResponse === r
                      ? `${RSVP_CFG[r].bg} ${RSVP_CFG[r].border} ${RSVP_CFG[r].text} ring-2 ring-blue-500/20`
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {RSVP_CFG[r].label}
                </button>
              ))}
            </div>
          )}

          {/* Organiser Status Transitions */}
          {meeting.isOrganiser && (
            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-200/80 dark:border-slate-800 flex-wrap">
              <span className="text-xs font-semibold text-slate-500">
                Update Status:
              </span>
              {(['Scheduled', 'InProgress', 'Completed', 'Cancelled'] as MeetingStatus[]).map(
                (s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => statusMut.mutate(s)}
                    disabled={statusMut.isPending}
                    className={`px-3 py-1 rounded-xl text-xs font-semibold transition border cursor-pointer ${
                      meeting.status === s
                        ? `${STATUS_CFG[s].bg} ${STATUS_CFG[s].border} ${STATUS_CFG[s].text}`
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {STATUS_CFG[s].label}
                  </button>
                )
              )}
            </div>
          )}
        </div>

        {/* Tab Strip */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-950/20 px-4 sm:px-6 gap-2 flex-shrink-0">
          {(
            [
              { key: 'details', label: 'Details & Minutes' },
              {
                key: 'attendees',
                label: `Attendees (${meeting.attendees.length})`,
              },
              {
                key: 'actions',
                label: `Action Items (${meeting.actionItems.length})`,
              },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`py-3 px-3 text-xs sm:text-sm font-semibold transition border-b-2 cursor-pointer ${
                tab === t.key
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {/* DETAILS TAB */}
          {tab === 'details' && (
            <div className="space-y-4">
              {meeting.agenda && (
                <div>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Meeting Agenda
                  </h4>
                  <p className="text-slate-800 dark:text-slate-200 text-xs sm:text-sm whitespace-pre-wrap bg-slate-50 dark:bg-slate-950/60 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 leading-relaxed">
                    {meeting.agenda}
                  </p>
                </div>
              )}

              {/* Notes / Minutes */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Official Minutes & Discussion Notes
                  </h4>
                  {meeting.isOrganiser && !editingNotes && (
                    <button
                      type="button"
                      onClick={() => setEditingNotes(true)}
                      className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                    >
                      {meeting.notes ? 'Edit Minutes' : '+ Add Minutes'}
                    </button>
                  )}
                </div>

                {editingNotes ? (
                  <div className="space-y-3">
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={6}
                      className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none leading-relaxed"
                      placeholder="Capture key decisions, takeaways, and deliverables…"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => updateMut.mutate({ notes })}
                        disabled={updateMut.isPending}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition shadow-sm cursor-pointer"
                      >
                        {updateMut.isPending ? 'Saving…' : 'Save Notes'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingNotes(false);
                          setNotes(meeting.notes ?? '');
                        }}
                        className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : meeting.notes ? (
                  <p className="text-slate-800 dark:text-slate-200 text-xs sm:text-sm whitespace-pre-wrap bg-slate-50 dark:bg-slate-950/60 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 leading-relaxed">
                    {meeting.notes}
                  </p>
                ) : (
                  <p className="text-slate-400 text-xs sm:text-sm italic py-2">
                    No meeting minutes recorded yet.
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2.5 pt-3 border-t border-slate-200/80 dark:border-slate-800">
                <Avatar name={meeting.organisedByName} size="xs" />
                <span className="text-slate-500 text-xs">
                  Organised by{' '}
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {meeting.organisedByName}
                  </span>
                </span>
              </div>
            </div>
          )}

          {/* ATTENDEES TAB */}
          {tab === 'attendees' && (
            <div className="space-y-2.5">
              {meeting.attendees.map((a) => (
                <div
                  key={a.userId}
                  className="flex items-center gap-3 p-3.5 bg-slate-50/70 dark:bg-slate-950/40 rounded-2xl border border-slate-200/80 dark:border-slate-800"
                >
                  <Avatar src={a.profilePhotoUrl} name={a.fullName} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-900 dark:text-slate-100 text-xs sm:text-sm font-bold truncate">
                      {a.fullName}
                      {a.userId === meeting.organisedByUserId && (
                        <span className="ml-2 text-[10px] text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20 font-semibold">
                          Host
                        </span>
                      )}
                    </p>
                    <p className="text-slate-500 text-[11px] truncate">
                      {a.role}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${RSVP_CFG[a.response].bg} ${RSVP_CFG[a.response].border} ${RSVP_CFG[a.response].text}`}
                  >
                    {RSVP_CFG[a.response].label}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* ACTION ITEMS TAB */}
          {tab === 'actions' && (
            <div className="space-y-3.5">
              {meeting.actionItems.length === 0 && (
                <div className="text-center py-8 text-slate-400 text-xs sm:text-sm">
                  No action items logged for this session.
                </div>
              )}

              {meeting.actionItems.map((item) => (
                <ActionItemRow
                  key={item.id}
                  item={item}
                  meetingId={meeting.id}
                  canEdit={
                    meeting.isOrganiser || item.assignedToUserId === user?.id
                  }
                />
              ))}

              {/* Add Action Item Form */}
              <div className="mt-4 border-t border-slate-200/80 dark:border-slate-800 pt-4 space-y-3 bg-slate-50/50 dark:bg-slate-950/40 p-4 rounded-2xl border">
                <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Assign New Action Item
                </h5>
                <input
                  value={newActionDesc}
                  onChange={(e) => setNewActionDesc(e.target.value)}
                  placeholder="Task description or deliverable…"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <select
                    value={newActionAssignee}
                    onChange={(e) =>
                      setNewActionAssignee(
                        e.target.value ? Number(e.target.value) : ''
                      )
                    }
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Assign to Attendee…</option>
                    {meeting.attendees.map((a) => (
                      <option key={a.userId} value={a.userId}>
                        {a.fullName}
                      </option>
                    ))}
                  </select>
                  <DatePicker
                    value={newActionDue}
                    onChange={setNewActionDue}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!newActionDesc.trim()) return;
                    addActionMut.mutate({
                      description: newActionDesc.trim(),
                      assignedToUserId: newActionAssignee || undefined,
                      dueDate: newActionDue || undefined,
                    });
                  }}
                  disabled={!newActionDesc.trim() || addActionMut.isPending}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs sm:text-sm font-semibold rounded-xl transition shadow-sm shadow-blue-500/20 cursor-pointer"
                >
                  {addActionMut.isPending ? 'Assigning…' : 'Record Action Item'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Create Meeting Modal ─────────────────────────────────────────────────────
const CreateMeetingModal: React.FC<{
  allUsers: { id: number; fullName: string }[];
  onClose: () => void;
}> = ({ allUsers, onClose }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [form, setForm] = useState<Omit<CreateMeetingDto, 'attendeeIds'>>({
    title: '',
    agenda: '',
    location: '',
    meetingType: 'Other',
    scheduledAt: '',
    durationMinutes: 30,
    isRecurring: false,
  });
  const [selectedAttendees, setSelectedAttendees] = useState<number[]>([]);
  const [attendeeSearch, setAttendeeSearch] = useState('');

  const createMut = useMutation({
    mutationFn: (d: object) => meetingApi.create(d),
    onSuccess: () => {
      toast.success('Meeting scheduled successfully');
      qc.invalidateQueries({ queryKey: ['meetings'] });
      onClose();
    },
    onError: () => toast.error('Failed to schedule meeting'),
  });

  const toggleAttendee = (id: number) =>
    setSelectedAttendees((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const filteredUsers = allUsers.filter(
    (u) =>
      u.id !== user?.id &&
      u.fullName.toLowerCase().includes(attendeeSearch.toLowerCase())
  );

  const handleSubmit = () => {
    if (!form.title.trim() || !form.scheduledAt) {
      toast.error('Title and Date & Time are required');
      return;
    }
    createMut.mutate({ ...form, attendeeIds: selectedAttendees });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/40 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Schedule New Meeting
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Broadcast invitations, establish an agenda, and assign attendees.
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

        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
              Meeting Title *
            </label>
            <input
              value={form.title}
              onChange={(e) =>
                setForm((f) => ({ ...f, title: e.target.value }))
              }
              placeholder="e.g. Weekly Product Architecture Review"
              className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
                Session Type
              </label>
              <select
                value={form.meetingType}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    meetingType: e.target.value as MeetingType,
                  }))
                }
                className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {MEETING_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.icon} {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
                Duration (minutes)
              </label>
              <input
                type="number"
                min={5}
                step={5}
                value={form.durationMinutes}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    durationMinutes: +e.target.value || 30,
                  }))
                }
                className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
                Date & Start Time *
              </label>
              <DateTimePicker
                value={form.scheduledAt}
                onChange={(v) => setForm((f) => ({ ...f, scheduledAt: v }))}
                placeholder="Select date & time"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
                Location or Video Link
              </label>
              <input
                value={form.location ?? ''}
                onChange={(e) =>
                  setForm((f) => ({ ...f, location: e.target.value }))
                }
                placeholder="Google Meet, Zoom, or Boardroom 3"
                className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
              Preliminary Agenda
            </label>
            <textarea
              value={form.agenda ?? ''}
              onChange={(e) =>
                setForm((f) => ({ ...f, agenda: e.target.value }))
              }
              rows={3}
              placeholder="Key discussion topics, demo goals, or decision points…"
              className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Attendees Picker */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Invite Attendees ({selectedAttendees.length} selected)
              </label>
              <div className="flex gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={() =>
                    setSelectedAttendees(filteredUsers.map((u) => u.id))
                  }
                  className="text-blue-600 hover:underline font-semibold cursor-pointer"
                >
                  Select All
                </button>
                <span className="text-slate-300 dark:text-slate-700">·</span>
                <button
                  type="button"
                  onClick={() => setSelectedAttendees([])}
                  className="text-slate-500 hover:underline font-semibold cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="relative mb-2">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400 pointer-events-none" />
              <input
                value={attendeeSearch}
                onChange={(e) => setAttendeeSearch(e.target.value)}
                placeholder="Search colleagues to invite…"
                className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl pl-8 pr-3.5 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="max-h-36 overflow-y-auto space-y-1.5 p-1 border border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-950/40">
              {filteredUsers.map((u) => {
                const selected = selectedAttendees.includes(u.id);
                return (
                  <div
                    key={u.id}
                    onClick={() => toggleAttendee(u.id)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer transition border select-none ${
                      selected
                        ? 'bg-blue-500/10 border-blue-500/30 text-blue-900 dark:text-blue-100 font-semibold'
                        : 'bg-white dark:bg-slate-900 border-slate-200/60 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-md border flex items-center justify-center flex-shrink-0 ${
                        selected
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800'
                      }`}
                    >
                      {selected && <CheckCircle2 className="w-3 h-3" />}
                    </div>
                    <Avatar name={u.fullName} size="xs" />
                    <span className="text-xs">{u.fullName}</span>
                  </div>
                );
              })}
              {filteredUsers.length === 0 && (
                <p className="text-slate-400 text-xs text-center py-3">
                  No matching team members found.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-6 border-t border-slate-200 dark:border-slate-800 flex gap-3 bg-slate-50/30 dark:bg-slate-950/20 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs sm:text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={createMut.isPending}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs sm:text-sm font-semibold transition shadow-sm shadow-blue-500/20 cursor-pointer"
          >
            {createMut.isPending ? 'Scheduling…' : 'Schedule Meeting'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Meeting Card ─────────────────────────────────────────────────────────────
const MeetingCard: React.FC<{
  meeting: MeetingDto;
  onClick: () => void;
}> = ({ meeting, onClick }) => {
  const typeCfg = getMeetingTypeCfg(meeting.meetingType);
  const cfg = STATUS_CFG[meeting.status];
  return (
    <Card
      onClick={onClick}
      className={`border-slate-200/80 dark:border-slate-800 hover:border-blue-500/50 dark:hover:border-blue-500/50 transition-all cursor-pointer group shadow-sm hover:shadow-md flex flex-col justify-between ${
        meeting.status === 'Cancelled' ? 'opacity-60' : ''
      }`}
    >
      <CardContent className="p-5 space-y-3.5 flex-1 flex flex-col justify-between">
        <div className="space-y-3">
          {/* Header Row */}
          <div className="flex items-start justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-xl flex-shrink-0">{typeCfg.icon}</span>
              <div className="min-w-0">
                <h4 className="text-slate-900 dark:text-white font-bold text-sm leading-snug truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                  {meeting.title}
                </h4>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5 font-medium">
                  {typeCfg.label}
                </p>
              </div>
            </div>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${cfg.bg} ${cfg.border} ${cfg.text}`}
            >
              {cfg.label}
            </span>
          </div>

          {/* Schedule & Duration */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-200">
              <Clock className="w-3.5 h-3.5 text-blue-500" />
              <span>{formatDateTime(meeting.scheduledAt)}</span>
            </span>
            <span>·</span>
            <span>{meeting.durationMinutes}m</span>
          </div>

          {meeting.location && (
            <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 truncate">
              <MapPin className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
              <span className="truncate">{meeting.location}</span>
            </p>
          )}
        </div>

        {/* Footer / Attendees */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
          <div className="flex -space-x-1.5 overflow-hidden">
            {meeting.attendees.slice(0, 5).map((a) => (
              <Avatar
                key={a.userId}
                src={a.profilePhotoUrl}
                name={a.fullName}
                size="xs"
              />
            ))}
            {meeting.attendees.length > 5 && (
              <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[9px] font-bold text-slate-600 dark:text-slate-300 border-2 border-white dark:border-slate-900">
                +{meeting.attendees.length - 5}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {meeting.actionItems.length > 0 && (
              <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                {meeting.actionItems.filter((i) => i.status !== 'Done').length} open tasks
              </span>
            )}
            {!meeting.isOrganiser && meeting.myResponse && (
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${RSVP_CFG[meeting.myResponse].bg} ${RSVP_CFG[meeting.myResponse].border} ${RSVP_CFG[meeting.myResponse].text}`}
              >
                {RSVP_CFG[meeting.myResponse].label}
              </span>
            )}
            {meeting.isOrganiser && (
              <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                Host
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// ─── Main MeetingLogPage ──────────────────────────────────────────────────────
export const MeetingLogPage: React.FC = () => {
  const now = new Date();

  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [filterType, setFilterType] = useState<MeetingType | ''>('');
  const [filterStatus, setFilterStatus] = useState<MeetingStatus | ''>('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingDto | null>(null);
  const [view, setView] = useState<'all' | 'mine' | 'invited'>('all');

  // All active users for attendee picker
  const { data: allUsersRaw } = useQuery({
    queryKey: ['users-simple'],
    queryFn: () => managerApi.getAllUsers().then((r) => r.data),
    staleTime: 300_000,
  });
  const allUsers: { id: number; fullName: string }[] = allUsersRaw ?? [];

  const { data: meetings = [], isLoading } = useQuery<MeetingDto[]>({
    queryKey: ['meetings', month, year],
    queryFn: () => meetingApi.getAll(month, year).then((r) => r.data),
    staleTime: 30_000,
  });

  const prevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const monthLabel = new Date(year, month - 1, 1).toLocaleString('en-IN', {
    month: 'long',
    year: 'numeric',
  });

  // Filtered meetings
  const filtered = useMemo(() => {
    return meetings.filter((m) => {
      if (view === 'mine' && !m.isOrganiser) return false;
      if (view === 'invited' && m.isOrganiser) return false;
      if (filterType && m.meetingType !== filterType) return false;
      if (filterStatus && m.status !== filterStatus) return false;
      return true;
    });
  }, [meetings, view, filterType, filterStatus]);

  // Statistics
  const stats = useMemo(
    () => ({
      total: meetings.length,
      pending: meetings.filter(
        (m) => m.myResponse === 'Pending' && !m.isOrganiser
      ).length,
      openItems: meetings.reduce(
        (n, m) => n + m.actionItems.filter((i) => i.status !== 'Done').length,
        0
      ),
      upcoming: meetings.filter(
        (m) =>
          m.status === 'Scheduled' && new Date(m.scheduledAt) >= new Date()
      ).length,
    }),
    [meetings]
  );

  const openMeeting = (m: MeetingDto) => {
    const fresh = meetings.find((x) => x.id === m.id) ?? m;
    setSelectedMeeting(fresh);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* ── Page Header ── */}
      <PageHeader
        title="Meetings & Synchronization Hub"
        description="Schedule team huddles, capture structured minutes, govern action deliverables, and manage real-time attendance RSVPs."
        breadcrumbs={[
          { label: 'Workspace', href: '/' },
          { label: 'Collaboration' },
          { label: 'Meeting Log' },
        ]}
        badge={{ label: 'Live Action Tracker', variant: 'blue' }}
        actions={
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs sm:text-sm font-semibold transition shadow-sm shadow-blue-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Schedule Meeting</span>
          </button>
        }
      />

      {/* ── KPI Stats Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Scheduled Sessions"
          value={String(stats.total)}
          subtitle={`Total during ${monthLabel}`}
          icon={Calendar}
          color="blue"
        />
        <StatCard
          title="Upcoming Huddles"
          value={String(stats.upcoming)}
          subtitle="Ahead on your schedule"
          icon={Clock}
          color="purple"
        />
        <StatCard
          title="Pending RSVPs"
          value={String(stats.pending)}
          subtitle="Awaiting your confirmation"
          icon={AlertCircle}
          color="amber"
        />
        <StatCard
          title="Open Action Items"
          value={String(stats.openItems)}
          subtitle="Tasks pending completion"
          icon={CheckSquare}
          color="emerald"
        />
      </div>

      {/* ── Month Selector & View Filter Bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* View Segmented Switcher */}
        <div className="flex gap-1.5 bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl border border-slate-200/80 dark:border-slate-800 w-fit">
          <button
            type="button"
            onClick={() => setView('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer ${
              view === 'all'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            All Sessions
          </button>
          <button
            type="button"
            onClick={() => setView('mine')}
            className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer ${
              view === 'mine'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Host / Organised
          </button>
          <button
            type="button"
            onClick={() => setView('invited')}
            className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer ${
              view === 'invited'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Invited
          </button>
        </div>

        {/* Month Navigation */}
        <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-1 rounded-2xl shadow-sm w-fit">
          <button
            type="button"
            onClick={prevMonth}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            title="Previous Month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-3 py-1 text-xs sm:text-sm font-bold text-slate-900 dark:text-white min-w-[130px] text-center select-none">
            {monthLabel}
          </span>
          <button
            type="button"
            onClick={nextMonth}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            title="Next Month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Filters Bar ── */}
      <div className="flex flex-wrap gap-2.5 items-center justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as MeetingType | '')}
            className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl px-3 py-1.5 text-slate-700 dark:text-slate-300 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm"
          >
            <option value="">All Session Formats</option>
            {MEETING_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.icon} {t.label}
              </option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) =>
              setFilterStatus(e.target.value as MeetingStatus | '')
            }
            className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl px-3 py-1.5 text-slate-700 dark:text-slate-300 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm"
          >
            <option value="">All Statuses</option>
            {(['Scheduled', 'InProgress', 'Completed', 'Cancelled'] as MeetingStatus[]).map(
              (s) => (
                <option key={s} value={s}>
                  {STATUS_CFG[s].label}
                </option>
              )
            )}
          </select>
        </div>

        {(filterType || filterStatus) && (
          <button
            type="button"
            onClick={() => {
              setFilterType('');
              setFilterStatus('');
            }}
            className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* ── Meetings Grid ── */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl h-44 animate-pulse"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-slate-200/80 dark:border-slate-800">
          <CardContent className="text-center py-20 text-slate-400 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-500 mx-auto flex items-center justify-center">
              <Calendar className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              No meetings scheduled for this period
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Schedule your team's standups, architectural reviews, or 1-on-1s to collaborate seamlessly.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((m) => (
            <MeetingCard
              key={m.id}
              meeting={m}
              onClick={() => openMeeting(m)}
            />
          ))}
        </div>
      )}

      {/* ── Modals ── */}
      {showCreateModal && (
        <CreateMeetingModal
          allUsers={allUsers}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {selectedMeeting && (
        <MeetingModal
          meeting={selectedMeeting}
          allUsers={allUsers}
          onClose={() => setSelectedMeeting(null)}
        />
      )}
    </div>
  );
};

export default MeetingLogPage;