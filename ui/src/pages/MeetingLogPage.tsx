import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { managerApi, meetingApi } from '../services/api';
import { useAuth } from '../context/Authcontext';
import { useToast } from '../context/ToastContext';
import type {
  MeetingDto, MeetingAttendeeDto, MeetingActionItemDto,
  CreateMeetingDto, MeetingType, MeetingStatus, RsvpResponse,
} from '../types';
import { DatePicker } from '../components/DatePicker';
import { DateTimePicker } from '../components/DateTimePicker';

// ─── Constants ────────────────────────────────────────────────────────────────
const BACKEND_ORIGIN = 'https://localhost:7096';

const MEETING_TYPES: { value: MeetingType; label: string; emoji: string }[] = [
  { value: 'StandUp',       label: 'Stand-Up',       emoji: '☀️' },
  { value: 'Planning',      label: 'Planning',        emoji: '📋' },
  { value: 'Review',        label: 'Review',          emoji: '🔍' },
  { value: 'Retrospective', label: 'Retrospective',   emoji: '🔄' },
  { value: 'OneOnOne',      label: '1-on-1',          emoji: '👤' },
  { value: 'Other',         label: 'Other',           emoji: '📅' },
];

const STATUS_CFG: Record<MeetingStatus, { label: string; dot: string; text: string; bg: string }> = {
  Scheduled:  { label: 'Scheduled',   dot: 'bg-blue-500',    text: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/30'    },
  InProgress: { label: 'In Progress', dot: 'bg-amber-500',   text: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/30'  },
  Completed:  { label: 'Completed',   dot: 'bg-emerald-500', text: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
  Cancelled:  { label: 'Cancelled',   dot: 'bg-slate-500',   text: 'text-slate-400',   bg: 'bg-slate-700/40 border-slate-600/30'  },
};

const RSVP_CFG: Record<RsvpResponse, { label: string; text: string; bg: string }> = {
  Accepted: { label: 'Accepted', text: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
  Pending:  { label: 'Pending',  text: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/30'    },
  Declined: { label: 'Declined', text: 'text-rose-400',    bg: 'bg-rose-500/10 border-rose-500/30'      },
  Maybe:    { label: 'Maybe',    text: 'text-slate-400',   bg: 'bg-slate-700/40 border-slate-600/30'    },
};

// ─── Small helpers ────────────────────────────────────────────────────────────
const Avatar = ({ src, name, size = 'sm' }: { src?: string | null; name: string; size?: 'xs' | 'sm' | 'md' }) => {
  const sizeMap = { xs: 'w-5 h-5 text-[9px]', sm: 'w-7 h-7 text-xs', md: 'w-9 h-9 text-sm' };
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const resolved = src ? (src.startsWith('http') ? src : `${BACKEND_ORIGIN}${src}`) : null;
  if (resolved)
    return <img src={resolved} alt={name} className={`${sizeMap[size]} rounded-full object-cover flex-shrink-0`} />;
  return (
    <div className={`${sizeMap[size]} rounded-full bg-gradient-to-br from-blue-500 to-violet-600
      flex items-center justify-center font-bold text-white flex-shrink-0`}>
      {initials}
    </div>
  );
};

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
    timeZone: 'Asia/Kolkata',
  });
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const getMeetingTypeCfg = (type: MeetingType) =>
  MEETING_TYPES.find(t => t.value === type) ?? MEETING_TYPES[MEETING_TYPES.length - 1];

// ─── Action Item Row ──────────────────────────────────────────────────────────
const ActionItemRow = ({
  item, canEdit, meetingId,
}: { item: MeetingActionItemDto; canEdit: boolean; meetingId: number }) => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState(item.status);

  const updateMut = useMutation({
    mutationFn: (d: object) => meetingApi.updateActionItem(item.id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['meetings'] }); setEditing(false); },
    onError: () => toast.error('Failed to update action item'),
  });

  const deleteMut = useMutation({
    mutationFn: () => meetingApi.deleteActionItem(item.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meetings'] }),
    onError: () => toast.error('Failed to delete action item'),
  });

  const statusDot: Record<string, string> = {
    Open: 'bg-amber-500', InProgress: 'bg-blue-500', Done: 'bg-emerald-500',
  };

  return (
    <div className={`flex items-start gap-3 p-3 rounded-xl border transition-all
      ${item.status === 'Done' ? 'bg-slate-800/20 border-slate-800/50 opacity-60' : 'bg-slate-800/40 border-slate-700/50'}`}>
      {/* Status dot / cycle button */}
      {canEdit ? (
        <button
          title="Click to cycle status"
          onClick={() => {
            const next = item.status === 'Open' ? 'InProgress' : item.status === 'InProgress' ? 'Done' : 'Open';
            updateMut.mutate({ status: next });
          }}
          className={`w-3 h-3 rounded-full mt-1 flex-shrink-0 ${statusDot[item.status]} hover:opacity-70 transition`}
        />
      ) : (
        <span className={`w-3 h-3 rounded-full mt-1 flex-shrink-0 ${statusDot[item.status]}`} />
      )}

      <div className="flex-1 min-w-0">
        <p className={`text-sm ${item.status === 'Done' ? 'line-through text-slate-500' : 'text-slate-200'}`}>
          {item.description}
        </p>
        <div className="flex flex-wrap items-center gap-3 mt-1">
          {item.assignedToUserName && (
            <span className="text-xs text-slate-500">→ {item.assignedToUserName}</span>
          )}
          {item.dueDate && (
            <span className="text-xs text-slate-500">Due {formatDate(item.dueDate)}</span>
          )}
          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium
            ${item.status === 'Done' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
              : item.status === 'InProgress' ? 'text-blue-400 bg-blue-500/10 border-blue-500/20'
              : 'text-amber-400 bg-amber-500/10 border-amber-500/20'}`}>
            {item.status}
          </span>
        </div>
      </div>

      {canEdit && (
        <button
          onClick={() => deleteMut.mutate()}
          className="text-slate-600 hover:text-rose-400 transition text-sm flex-shrink-0"
          title="Delete">✕</button>
      )}
    </div>
  );
};

// ─── Meeting Detail Modal ─────────────────────────────────────────────────────
const MeetingModal = ({
  meeting, allUsers, onClose,
}: {
  meeting: MeetingDto;
  allUsers: { id: number; fullName: string }[];
  onClose: () => void;
}) => {
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
    onSuccess: () => { toast.success('RSVP updated'); qc.invalidateQueries({ queryKey: ['meetings'] }); },
    onError: () => toast.error('Failed to update RSVP'),
  });

  const updateMut = useMutation({
    mutationFn: (d: object) => meetingApi.update(meeting.id, d),
    onSuccess: () => { toast.success('Notes saved'); qc.invalidateQueries({ queryKey: ['meetings'] }); setEditingNotes(false); },
    onError: () => toast.error('Failed to save notes'),
  });

  const addActionMut = useMutation({
    mutationFn: (d: object) => meetingApi.addActionItem(meeting.id, d),
    onSuccess: () => {
      toast.success('Action item added');
      qc.invalidateQueries({ queryKey: ['meetings'] });
      setNewActionDesc(''); setNewActionAssignee(''); setNewActionDue('');
    },
    onError: () => toast.error('Failed to add action item'),
  });

  const statusMut = useMutation({
    mutationFn: (status: string) => meetingApi.update(meeting.id, { status }),
    onSuccess: () => { toast.success('Status updated'); qc.invalidateQueries({ queryKey: ['meetings'] }); },
    onError: () => toast.error('Failed to update status'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh]
        flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex-shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-lg">{typeCfg.emoji}</span>
                <span className="text-slate-400 text-xs">{typeCfg.label}</span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.text}`}>
                  {cfg.label}
                </span>
                {meeting.myResponse && !meeting.isOrganiser && (
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border
                    ${RSVP_CFG[meeting.myResponse].bg} ${RSVP_CFG[meeting.myResponse].text}`}>
                    {RSVP_CFG[meeting.myResponse].label}
                  </span>
                )}
              </div>
              <h2 className="text-white font-bold text-lg leading-tight">{meeting.title}</h2>
              <p className="text-slate-400 text-sm mt-1">
                {formatDateTime(meeting.scheduledAt)} · {meeting.durationMinutes} min
              </p>
              {meeting.location && (
                <p className="text-slate-500 text-xs mt-0.5">📍 {meeting.location}</p>
              )}
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-white text-xl flex-shrink-0">✕</button>
          </div>

          {/* RSVP buttons for invitees */}
          {!meeting.isOrganiser && meeting.status === 'Scheduled' && (
            <div className="flex gap-2 mt-3">
              {(['Accepted', 'Maybe', 'Declined'] as RsvpResponse[]).map(r => (
                <button key={r}
                  onClick={() => rsvpMut.mutate(r)}
                  disabled={rsvpMut.isPending}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition border
                    ${meeting.myResponse === r
                      ? `${RSVP_CFG[r].bg} ${RSVP_CFG[r].text}`
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}>
                  {RSVP_CFG[r].label}
                </button>
              ))}
            </div>
          )}

          {/* Status change (organiser only) */}
          {meeting.isOrganiser && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {(['Scheduled', 'InProgress', 'Completed', 'Cancelled'] as MeetingStatus[]).map(s => (
                <button key={s}
                  onClick={() => statusMut.mutate(s)}
                  disabled={statusMut.isPending}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition border
                    ${meeting.status === s
                      ? `${STATUS_CFG[s].bg} ${STATUS_CFG[s].text}`
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}>
                  {STATUS_CFG[s].label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800 flex-shrink-0">
          {([
            { key: 'details',   label: 'Details'     },
            { key: 'attendees', label: `Attendees (${meeting.attendees.length})` },
            { key: 'actions',   label: `Action Items (${meeting.actionItems.length})` },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-5 py-3 text-sm font-medium transition border-b-2
                ${tab === t.key
                  ? 'border-blue-500 text-white'
                  : 'border-transparent text-slate-400 hover:text-white'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* DETAILS tab */}
          {tab === 'details' && (
            <div className="space-y-4">
              {meeting.agenda && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Agenda</p>
                  <p className="text-slate-300 text-sm whitespace-pre-wrap bg-slate-800/40 rounded-xl p-3">
                    {meeting.agenda}
                  </p>
                </div>
              )}

              {/* Notes — editable by organiser */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Meeting Notes / Minutes
                  </p>
                  {meeting.isOrganiser && !editingNotes && (
                    <button onClick={() => setEditingNotes(true)}
                      className="text-xs text-blue-400 hover:text-blue-300 transition">
                      {meeting.notes ? 'Edit' : '+ Add notes'}
                    </button>
                  )}
                </div>

                {editingNotes ? (
                  <div className="space-y-2">
                    <textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      rows={6}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm
                        text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      placeholder="Add meeting minutes, decisions, key points…"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => updateMut.mutate({ notes })}
                        disabled={updateMut.isPending}
                        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-lg transition">
                        Save
                      </button>
                      <button onClick={() => { setEditingNotes(false); setNotes(meeting.notes ?? ''); }}
                        className="px-4 py-1.5 bg-slate-800 text-slate-400 text-xs rounded-lg hover:text-white transition">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : meeting.notes ? (
                  <p className="text-slate-300 text-sm whitespace-pre-wrap bg-slate-800/40 rounded-xl p-3">
                    {meeting.notes}
                  </p>
                ) : (
                  <p className="text-slate-600 text-sm italic">No notes yet.</p>
                )}
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                <Avatar name={meeting.organisedByName} size="xs" />
                <span className="text-slate-500 text-xs">Organised by <span className="text-slate-300">{meeting.organisedByName}</span></span>
              </div>
            </div>
          )}

          {/* ATTENDEES tab */}
          {tab === 'attendees' && (
            <div className="space-y-2">
              {meeting.attendees.map(a => (
                <div key={a.userId} className="flex items-center gap-3 p-3 bg-slate-800/40 rounded-xl border border-slate-700/50">
                  <Avatar src={a.profilePhotoUrl} name={a.fullName} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-200 text-sm font-medium truncate">
                      {a.fullName}
                      {a.userId === meeting.organisedByUserId && (
                        <span className="ml-2 text-[10px] text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded">Organiser</span>
                      )}
                    </p>
                    <p className="text-slate-500 text-xs">{a.role}</p>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full border
                    ${RSVP_CFG[a.response].bg} ${RSVP_CFG[a.response].text}`}>
                    {RSVP_CFG[a.response].label}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* ACTION ITEMS tab */}
          {tab === 'actions' && (
            <div className="space-y-3">
              {meeting.actionItems.length === 0 && (
                <p className="text-slate-600 text-sm italic">No action items yet.</p>
              )}

              {meeting.actionItems.map(item => (
                <ActionItemRow
                  key={item.id}
                  item={item}
                  meetingId={meeting.id}
                  canEdit={meeting.isOrganiser || item.assignedToUserId === user?.id}
                />
              ))}

              {/* Add new action item */}
              <div className="mt-4 border-t border-slate-800 pt-4 space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Add Action Item</p>
                <input
                  value={newActionDesc}
                  onChange={e => setNewActionDesc(e.target.value)}
                  placeholder="Describe the action item…"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm
                    text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex gap-2">
                  <select
                    value={newActionAssignee}
                    onChange={e => setNewActionAssignee(e.target.value ? Number(e.target.value) : '')}
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm
                      text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Assign to…</option>
                    {meeting.attendees.map(a => (
                      <option key={a.userId} value={a.userId}>{a.fullName}</option>
                    ))}
                  </select>
                  {/* <input
                    type="date"
                    value={newActionDue}
                    onChange={e => setNewActionDue(e.target.value)}
                    className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm
                      text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  /> */}
                  <DatePicker value={newActionDue} onChange={setNewActionDue} />
                </div>
                <button
                  onClick={() => {
                    if (!newActionDesc.trim()) return;
                    addActionMut.mutate({
                      description: newActionDesc.trim(),
                      assignedToUserId: newActionAssignee || undefined,
                      dueDate: newActionDue || undefined,
                    });
                  }}
                  disabled={!newActionDesc.trim() || addActionMut.isPending}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white
                    text-sm font-medium rounded-xl transition">
                  Add Action Item
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
const CreateMeetingModal = ({
  allUsers, onClose,
}: { allUsers: { id: number; fullName: string }[]; onClose: () => void }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [form, setForm] = useState<Omit<CreateMeetingDto, 'attendeeIds'>>({
    title: '', agenda: '', location: '',
    meetingType: 'Other', scheduledAt: '',
    durationMinutes: 30, isRecurring: false,
  });
  const [selectedAttendees, setSelectedAttendees] = useState<number[]>([]);
  const [attendeeSearch, setAttendeeSearch] = useState('');

  const createMut = useMutation({
    mutationFn: (d: object) => meetingApi.create(d),
    onSuccess: () => {
      toast.success('Meeting created!');
      qc.invalidateQueries({ queryKey: ['meetings'] });
      onClose();
    },
    onError: () => toast.error('Failed to create meeting'),
  });

  const toggleAttendee = (id: number) =>
    setSelectedAttendees(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );

  const filteredUsers = allUsers.filter(u =>
    u.id !== user?.id &&
    u.fullName.toLowerCase().includes(attendeeSearch.toLowerCase())
  );

  const handleSubmit = () => {
    if (!form.title.trim() || !form.scheduledAt) {
      toast.error('Title and date/time are required');
      return;
    }
    createMut.mutate({ ...form, attendeeIds: selectedAttendees });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg max-h-[90vh]
        flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>

        <div className="p-5 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
          <h2 className="text-white font-bold">Schedule Meeting</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-xl">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Title */}
          <div>
            <label className="text-xs text-slate-400 font-medium mb-1 block">Title *</label>
            <input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Weekly Sync"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm
                text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Type + Duration */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 font-medium mb-1 block">Type</label>
              <select
                value={form.meetingType}
                onChange={e => setForm(f => ({ ...f, meetingType: e.target.value as MeetingType }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm
                  text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500">
                {MEETING_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 font-medium mb-1 block">Duration (min)</label>
              <input
                type="number" min={5} step={5}
                value={form.durationMinutes}
                onChange={e => setForm(f => ({ ...f, durationMinutes: +e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm
                  text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Date/time + Location */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 font-medium mb-1 block">Date & Time *</label>
              {/* <input
                type="datetime-local"
                value={form.scheduledAt}
                onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm
                  text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              /> */}
              <DateTimePicker value={form.scheduledAt}
                onChange={v => setForm(f => ({ ...f, scheduledAt: v }))}
                placeholder="Select date & time" />
            </div>
            <div>
              <label className="text-xs text-slate-400 font-medium mb-1 block">Location / Link</label>
              <input
                value={form.location ?? ''}
                onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                placeholder="Room / Zoom link"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm
                  text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Agenda */}
          <div>
            <label className="text-xs text-slate-400 font-medium mb-1 block">Agenda</label>
            <textarea
              value={form.agenda ?? ''}
              onChange={e => setForm(f => ({ ...f, agenda: e.target.value }))}
              rows={3}
              placeholder="Topics to cover…"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm
                text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Attendees */}
          <div>
            <label className="text-xs text-slate-400 font-medium mb-1 block">
              Invite Attendees{selectedAttendees.length > 0 && ` (${selectedAttendees.length} selected)`}
            </label>
            <input
              value={attendeeSearch}
              onChange={e => setAttendeeSearch(e.target.value)}
              placeholder="Search colleagues…"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm
                text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
            />
            <div className="max-h-36 overflow-y-auto space-y-1">
              {filteredUsers.map(u => {
                const selected = selectedAttendees.includes(u.id);
                return (
                  <div
                    key={u.id}
                    onClick={() => toggleAttendee(u.id)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer transition
                      ${selected ? 'bg-blue-600/20 border border-blue-500/30' : 'bg-slate-800/50 border border-transparent hover:border-slate-600'}`}>
                    <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0
                      ${selected ? 'bg-blue-600 border-blue-600' : 'border-slate-600'}`}>
                      {selected && <span className="text-white text-[10px]">✓</span>}
                    </div>
                    <span className="text-slate-300 text-sm">{u.fullName}</span>
                  </div>
                );
              })}
              {filteredUsers.length === 0 && (
                <p className="text-slate-600 text-xs text-center py-2">No users found</p>
              )}
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-slate-800 flex gap-3 flex-shrink-0">
          <button onClick={onClose}
            className="flex-1 py-2.5 bg-slate-800 text-slate-400 text-sm rounded-xl hover:text-white transition">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={createMut.isPending}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white
              text-sm font-medium rounded-xl transition">
            {createMut.isPending ? 'Creating…' : 'Create Meeting'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Meeting Card ─────────────────────────────────────────────────────────────
const MeetingCard = ({
  meeting, onClick,
}: { meeting: MeetingDto; onClick: () => void }) => {
  const typeCfg = getMeetingTypeCfg(meeting.meetingType);
  const cfg = STATUS_CFG[meeting.status];
  const isPast = new Date(meeting.scheduledAt) < new Date();

  return (
    <div
      onClick={onClick}
      className={`bg-slate-900 border rounded-2xl p-4 cursor-pointer transition-all
        hover:border-slate-600 hover:bg-slate-800/60
        ${meeting.status === 'Cancelled' ? 'opacity-50' : ''}
        ${isPast && meeting.status === 'Scheduled' ? 'border-slate-800' : 'border-slate-800'}`}>

      {/* Top row */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base flex-shrink-0">{typeCfg.emoji}</span>
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm truncate">{meeting.title}</p>
            <p className="text-slate-500 text-xs mt-0.5">{typeCfg.label}</p>
          </div>
        </div>
        <span className={`text-[10px] font-semibold px-2 py-1 rounded-full border flex-shrink-0 ${cfg.bg} ${cfg.text}`}>
          {cfg.label}
        </span>
      </div>

      {/* Time + duration */}
      <div className="flex items-center gap-2 text-xs text-slate-400 mb-3">
        <span>🕐</span>
        <span>{formatDateTime(meeting.scheduledAt)}</span>
        <span className="text-slate-600">·</span>
        <span>{meeting.durationMinutes}m</span>
      </div>

      {meeting.location && (
        <p className="text-xs text-slate-500 mb-3 truncate">📍 {meeting.location}</p>
      )}

      {/* Bottom row */}
      <div className="flex items-center justify-between">
        {/* Attendee avatars */}
        <div className="flex -space-x-1">
          {meeting.attendees.slice(0, 5).map(a => (
            <Avatar key={a.userId} src={a.profilePhotoUrl} name={a.fullName} size="xs" />
          ))}
          {meeting.attendees.length > 5 && (
            <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center
              text-[9px] text-slate-400 border border-slate-900">
              +{meeting.attendees.length - 5}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {meeting.actionItems.length > 0 && (
            <span className="text-xs text-slate-500">
              {meeting.actionItems.filter(i => i.status !== 'Done').length} open items
            </span>
          )}
          {!meeting.isOrganiser && meeting.myResponse && (
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border
              ${RSVP_CFG[meeting.myResponse].bg} ${RSVP_CFG[meeting.myResponse].text}`}>
              {RSVP_CFG[meeting.myResponse].label}
            </span>
          )}
          {meeting.isOrganiser && (
            <span className="text-[10px] text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-full">
              Organiser
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export const MeetingLogPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const now = new Date();

  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear]   = useState(now.getFullYear());
  const [filterType, setFilterType] = useState<MeetingType | ''>('');
  const [filterStatus, setFilterStatus] = useState<MeetingStatus | ''>('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingDto | null>(null);
  const [view, setView] = useState<'all' | 'mine' | 'invited'>('all');

// All active users (for attendee picker)
  const { data: allUsersRaw } = useQuery({
    queryKey: ['users-simple'],
    queryFn: () => managerApi.getAllUsers().then(r => r.data),
    staleTime: 300_000,
  });
  const allUsers: { id: number; fullName: string }[] = allUsersRaw ?? [];

  const { data: meetings = [], isLoading } = useQuery<MeetingDto[]>({
    queryKey: ['meetings', month, year],
    queryFn: () => meetingApi.getAll(month, year).then(r => r.data),
    staleTime: 30_000,
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => meetingApi.delete(id),
    onSuccess: () => { toast.success('Meeting deleted'); qc.invalidateQueries({ queryKey: ['meetings'] }); setSelectedMeeting(null); },
    onError: () => toast.error('Failed to delete meeting'),
  });

  // Month navigation
  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };
  const monthLabel = new Date(year, month - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });

  // Filtered meetings
  const filtered = useMemo(() => {
    return meetings.filter(m => {
      if (view === 'mine'    && !m.isOrganiser) return false;
      if (view === 'invited' && m.isOrganiser)  return false;
      if (filterType   && m.meetingType !== filterType)   return false;
      if (filterStatus && m.status      !== filterStatus) return false;
      return true;
    });
  }, [meetings, view, filterType, filterStatus]);

  // Stats
  const stats = useMemo(() => ({
    total:     meetings.length,
    pending:   meetings.filter(m => m.myResponse === 'Pending' && !m.isOrganiser).length,
    openItems: meetings.reduce((n, m) => n + m.actionItems.filter(i => i.status !== 'Done').length, 0),
    upcoming:  meetings.filter(m => m.status === 'Scheduled' && new Date(m.scheduledAt) >= new Date()).length,
  }), [meetings]);

  // When user clicks a card, use freshest data from cache
  const openMeeting = (m: MeetingDto) => {
    const fresh = meetings.find(x => x.id === m.id) ?? m;
    setSelectedMeeting(fresh);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Meeting Log 🤝</h1>
          <p className="text-slate-400 text-sm mt-1">Schedule, track, and follow up on team meetings</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500
            text-white text-sm font-semibold rounded-xl transition shadow-lg shadow-blue-500/20">
          + Schedule Meeting
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'This Month',    value: stats.total,     color: 'text-white'        },
          { label: 'Upcoming',      value: stats.upcoming,  color: 'text-blue-400'     },
          { label: 'Pending RSVP',  value: stats.pending,   color: 'text-amber-400'    },
          { label: 'Open Actions',  value: stats.openItems, color: 'text-rose-400'     },
        ].map(s => (
          <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-slate-500 text-xs mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center mb-4">
        {/* Month nav */}
        <div className="flex items-center gap-1">
          <button onClick={prevMonth}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800
              border border-slate-700 text-slate-300 hover:text-white transition">‹</button>
          <span className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg
            text-slate-300 text-sm min-w-[140px] text-center">{monthLabel}</span>
          <button onClick={nextMonth}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800
              border border-slate-700 text-slate-300 hover:text-white transition">›</button>
        </div>

        {/* View filter */}
        <div className="flex rounded-xl overflow-hidden border border-slate-700">
          {([
            { key: 'all',     label: 'All'      },
            { key: 'mine',    label: 'Organised' },
            { key: 'invited', label: 'Invited'   },
          ] as const).map(v => (
            <button key={v.key} onClick={() => setView(v.key)}
              className={`px-3 py-1.5 text-xs font-medium transition
                ${view === v.key ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
              {v.label}
            </button>
          ))}
        </div>

        {/* Type filter */}
        <select value={filterType}
          onChange={e => setFilterType(e.target.value as MeetingType | '')}
          className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-sm
            text-slate-300 focus:outline-none">
          <option value="">All types</option>
          {MEETING_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>
          ))}
        </select>

        {/* Status filter */}
        <select value={filterStatus}
          onChange={e => setFilterStatus(e.target.value as MeetingStatus | '')}
          className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-sm
            text-slate-300 focus:outline-none">
          <option value="">All statuses</option>
          {(Object.keys(STATUS_CFG) as MeetingStatus[]).map(s => (
            <option key={s} value={s}>{STATUS_CFG[s].label}</option>
          ))}
        </select>
      </div>

      {/* Meeting grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl h-40 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-slate-800 rounded-2xl">
          <div className="text-4xl mb-3">🤝</div>
          <p className="text-slate-300 font-semibold">No meetings found</p>
          <p className="text-slate-500 text-sm mt-1">Schedule one to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(m => (
            <MeetingCard key={m.id} meeting={m} onClick={() => openMeeting(m)} />
          ))}
        </div>
      )}

      {/* Modals */}
      {showCreateModal && (
        <CreateMeetingModal allUsers={allUsers} onClose={() => setShowCreateModal(false)} />
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