// ─────────────────────────────────────────────────────────────────────────────
//  FILE: ui/src/pages/Teamcomponents.tsx
//  Shared Team Components - Modern Design System Upgrade
//
//  Exports (logic unchanged):
//  ✅ EODReportModal     — used on Dashboard (AI auto-fill, update existing, mood)
//  ✅ TeamPresencePanel  — used on Dashboard (my status + team list, 30s refresh)
//  ✅ GiveKudosForm      — used on Kudos page
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { eodApi, presenceApi, kudosApi, aiChatApi } from '../services/api';
import type { UserPresence } from '../types';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/Authcontext';
import { Card, CardContent } from '../components/ui/Card';
import {
  X,
  FileText,
  Sparkles,
  Eraser,
  CheckCircle2,
  Ban,
  ClipboardList,
  Lightbulb,
  Smile,
  Loader2,
  Send,
  RefreshCw,
  Users,
  HandHelping,
  Circle,
  Trophy,
  ChevronDown,
  MessageSquare,
} from 'lucide-react';

// ─── Shared styles ────────────────────────────────────────────────────────────

const INPUT_CLS =
  'w-full bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white ' +
  'placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl px-4 py-3 text-sm ' +
  'focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition';

// ═══════════════════════════════════════════════════════════════════════════════
//  Feature 6: EOD Report Modal
// ═══════════════════════════════════════════════════════════════════════════════
interface EODReportModalProps {
  open: boolean;
  onClose: () => void;
}

const MOOD_OPTIONS = [
  { value: 'Great',    emoji: '🚀', label: 'Great - Productive Day!' },
  { value: 'Good',     emoji: '😊', label: 'Good - On Track' },
  { value: 'Okay',     emoji: '😐', label: 'Okay - Normal Day' },
  { value: 'Tired',    emoji: '😴', label: 'Tired - Exhausted' },
  { value: 'Stressed', emoji: '😰', label: 'Stressed - Challenging' },
];

const EMPTY_EOD_FORM = {
  whatWasDone: '',
  blockers: '',
  planForTomorrow: '',
  learnings: '',
  moodRating: 'Good',
};

export const EODReportModal = ({ open, onClose }: EODReportModalProps) => {
  const [form, setForm] = useState(EMPTY_EOD_FORM);

  const { toast } = useToast();
  const qc = useQueryClient();

  const [isGenerating, setIsGenerating] = useState(false);

  const handleAiGenerate = async () => {
    setIsGenerating(true);
    try {
      const res = await aiChatApi.getEodDraft();
      if (res.data.success && res.data.draft) {
        setForm((prev) => ({
          ...prev,
          whatWasDone: res.data.draft.whatWasDone || prev.whatWasDone,
          blockers: res.data.draft.blockers || prev.blockers,
          planForTomorrow: res.data.draft.planForTomorrow || prev.planForTomorrow,
          learnings: res.data.draft.learnings || prev.learnings,
          moodRating: res.data.draft.moodRating || prev.moodRating,
        }));
        toast.success("✨ Form filled with today’s accomplishments and tasks!");
      } else {
        toast.error(res.data.message || "Could not generate draft. Please ensure you are checked in.");
      }
    } catch {
      toast.error("Failed to generate AI EOD draft.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Fetch existing EOD report for today (if any)
  const { data: existingReport, isLoading: isFetching } = useQuery({
    queryKey: ['eodToday'],
    queryFn: () => eodApi.getToday().then(r => r.data),
    enabled: open, // Only fetch when modal is open
  });

  // Reset or pre-fill form when modal opens
  useEffect(() => {
    if (open) {
      if (existingReport) {
        setForm({
          whatWasDone: existingReport.whatWasDone || '',
          blockers: existingReport.blockers || '',
          planForTomorrow: existingReport.planForTomorrow || '',
          learnings: existingReport.learnings || '',
          moodRating: existingReport.moodRating || 'Good',
        });
      } else {
        setForm(EMPTY_EOD_FORM);
      }
    }
  }, [open, existingReport]);

  const handleClearForm = () => {
    setForm(EMPTY_EOD_FORM);
    toast.info('Form fields cleared.');
  };

  // Submit EOD Report mutation
  const submitMutation = useMutation({
    mutationFn: () => eodApi.submit(form),
    onSuccess: () => {
      toast.success('✅ EOD report submitted! Great work today 🎉');
      setForm(EMPTY_EOD_FORM);
      qc.invalidateQueries({ queryKey: ['eodToday'] });
      qc.invalidateQueries({ queryKey: ['eodHistory'] });
      onClose();
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Failed to submit report';
      toast.error(`❌ ${message}`);
    },
  });

  if (!open) return null;

  const isLoading = submitMutation.isPending;
  const isUpdating = !!existingReport;

  const fields: {
    key: keyof typeof form;
    label: string;
    icon: React.ElementType;
    iconCls: string;
    placeholder: string;
    required: boolean;
    rows: number;
  }[] = [
    {
      key: 'whatWasDone',
      label: 'What did you accomplish today?',
      icon: CheckCircle2,
      iconCls: 'text-emerald-500',
      placeholder: 'List your key accomplishments, features completed, bugs fixed...',
      required: true,
      rows: 3,
    },
    {
      key: 'blockers',
      label: 'Blockers or issues?',
      icon: Ban,
      iconCls: 'text-rose-500',
      placeholder: 'Any blockers, bugs, dependencies, or issues you faced...',
      required: false,
      rows: 2,
    },
    {
      key: 'planForTomorrow',
      label: 'Plan for tomorrow?',
      icon: ClipboardList,
      iconCls: 'text-blue-500',
      placeholder: 'What will you work on tomorrow? What are your priorities?',
      required: false,
      rows: 2,
    },
    {
      key: 'learnings',
      label: 'Learnings?',
      icon: Lightbulb,
      iconCls: 'text-amber-500',
      placeholder: 'Something new you learned today, best practices, insights...',
      required: false,
      rows: 2,
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Gradient Header ── */}
        <div className="relative bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 p-5 sm:p-6 text-white">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-black/20 hover:bg-black/40 text-white/80 hover:text-white transition"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3 pr-10">
            <div className="w-11 h-11 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-bold">End of Day Report</h3>
              <p className="text-xs text-white/80 mt-0.5">
                {isUpdating ? 'Update your EOD report for today' : 'Wrap up your day — takes 2 minutes'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-4">
            <button
              type="button"
              onClick={handleAiGenerate}
              disabled={isGenerating}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 border border-white/25 transition disabled:opacity-60 disabled:cursor-not-allowed"
              title="Auto-fill form using today's completed tasks and activity"
            >
              {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {isGenerating ? 'Generating…' : 'Auto-Generate with AI'}
            </button>
            <button
              type="button"
              onClick={handleClearForm}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-black/15 hover:bg-black/25 border border-white/15 transition"
              title="Clear all inputs"
            >
              <Eraser className="w-3.5 h-3.5" />
              Clear Form
            </button>
          </div>
        </div>

        {/* ── Body (scrollable) ── */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {isUpdating && (
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                You already submitted today's EOD report. You can update it.
              </p>
            </div>
          )}

          {isFetching && (
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <Loader2 className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin shrink-0" />
              <p className="text-xs font-medium text-blue-700 dark:text-blue-400">Loading your report…</p>
            </div>
          )}

          {fields.map((field) => {
            const Icon = field.icon;
            return (
              <div key={field.key}>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">
                  <Icon className={`w-4 h-4 ${field.iconCls}`} />
                  {field.label}
                  {field.required && <span className="text-rose-500">*</span>}
                </label>
                <textarea
                  value={form[field.key]}
                  onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                  placeholder={field.placeholder}
                  rows={field.rows}
                  className={`${INPUT_CLS} resize-none`}
                />
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 text-right">
                  {form[field.key].length} characters
                </p>
              </div>
            );
          })}

          {/* Mood selector */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3">
              <Smile className="w-4 h-4 text-violet-500" />
              How was your mood today?
            </label>
            <div className="grid grid-cols-5 gap-2">
              {MOOD_OPTIONS.map((mood) => {
                const active = form.moodRating === mood.value;
                return (
                  <button
                    key={mood.value}
                    type="button"
                    onClick={() => setForm({ ...form, moodRating: mood.value })}
                    className={`flex flex-col items-center justify-center py-3 rounded-2xl border transition ${
                      active
                        ? 'border-blue-500 bg-blue-500/10 ring-2 ring-blue-500/20 scale-[1.03]'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                    title={mood.label}
                  >
                    <span className="text-2xl">{mood.emoji}</span>
                    <span className={`text-[11px] mt-1 font-medium ${
                      active ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'
                    }`}>
                      {mood.label.split(' ')[0]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 flex gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold py-2.5 rounded-xl transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => submitMutation.mutate()}
            disabled={isLoading || !form.whatWasDone.trim()}
            className="flex-1 inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold py-2.5 rounded-xl shadow-md shadow-blue-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : isUpdating ? <RefreshCw className="w-4 h-4" /> : <Send className="w-4 h-4" />}
            {isLoading ? 'Submitting…' : isUpdating ? 'Update Report' : 'Submit Report'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
//  Feature 9: Team Presence Panel
// ═══════════════════════════════════════════════════════════════════════════════

const PRESENCE_STYLE: Record<string, { dot: string; label: string; chip: string }> = {
  Online:    { dot: 'bg-emerald-500', label: 'Online',     chip: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' },
  Busy:      { dot: 'bg-rose-500',    label: 'Busy',       chip: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30' },
  InMeeting: { dot: 'bg-amber-500',   label: 'In Meeting', chip: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30' },
  Away:      { dot: 'bg-slate-400',   label: 'Away',       chip: 'bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/30' },
  Offline:   { dot: 'bg-slate-300 dark:bg-slate-600', label: 'Offline', chip: '' },
};

export const TeamPresencePanel = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: team, isLoading } = useQuery<UserPresence[]>({
    queryKey: ['teamPresence'],
    queryFn: () => presenceApi.getTeam().then(r => r.data),
    refetchInterval: 30_000
  });

  const [myStatus, setMyStatus] = useState('Online');
  const [available, setAvailable] = useState(false);

  const updatePresence = useMutation({
    mutationFn: (d: object) => presenceApi.update(d),
    onSuccess: () => {
      toast.success('Status updated');
      qc.invalidateQueries({ queryKey: ['teamPresence'] });
    }
  });

  const statuses = ['Online', 'Busy', 'InMeeting', 'Away'];

  const myTeam = team?.filter(m => m.user.id !== user?.id) ?? [];
  const online = myTeam.filter(m => m.status !== 'Offline' && m.isCheckedInToday);
  const availableDevs = myTeam.filter(m => m.isAvailableForHelp);

  return (
    <Card>
      <CardContent>
        {/* Title */}
        <div className="flex items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Team Presence</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Live · refreshes every 30s</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {online.length} online
            </span>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-semibold bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
              <HandHelping className="w-3 h-3" />
              {availableDevs.length} can help
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* ── My status ── */}
          <div className="lg:col-span-2 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 h-fit">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">My Status</p>

            <div className="grid grid-cols-2 gap-2 mb-4">
              {statuses.map(s => {
                const st = PRESENCE_STYLE[s];
                const active = myStatus === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setMyStatus(s)}
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition ${
                      active
                        ? st.chip
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${st.dot}`} />
                    {st.label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setAvailable(!available)}
              className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 mb-3"
            >
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <HandHelping className="w-4 h-4 text-violet-500" />
                Available for help
              </span>
              <span className={`relative w-9 h-5 rounded-full transition ${available ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'}`}>
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${
                  available ? 'left-[18px]' : 'left-0.5'
                }`} />
              </span>
            </button>

            <button
              type="button"
              onClick={() => updatePresence.mutate({ status: myStatus, isAvailableForHelp: available })}
              disabled={updatePresence.isPending}
              className="w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold py-2.5 rounded-xl shadow-md shadow-blue-500/20 transition disabled:opacity-50"
            >
              {updatePresence.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Update Status
            </button>
          </div>

          {/* ── Team list ── */}
          <div className="lg:col-span-3">
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-14 rounded-xl bg-slate-100 dark:bg-slate-800/60 animate-pulse" />
                ))}
              </div>
            ) : myTeam.length === 0 ? (
              <div className="h-full min-h-[140px] flex flex-col items-center justify-center text-center rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                <Users className="w-7 h-7 text-slate-300 dark:text-slate-600" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-2">No teammates yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {myTeam.slice(0, 6).map(member => {
                  const st = PRESENCE_STYLE[member.status] ?? PRESENCE_STYLE.Offline;
                  return (
                    <div
                      key={member.user.id}
                      className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800"
                    >
                      <div className="relative shrink-0">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-xs font-bold text-white">
                          {member.user.fullName.charAt(0)}
                        </div>
                        <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${st.dot}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{member.user.fullName}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{st.label}</p>
                      </div>
                      {member.isAvailableForHelp && (
                        <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full shrink-0">
                          Available
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {myTeam.length > 6 && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 flex items-center gap-1">
                <Circle className="w-2 h-2 fill-current" /> +{myTeam.length - 6} more teammates
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
//  Feature 9: Give Kudos Form
// ═══════════════════════════════════════════════════════════════════════════════
interface KudosFormProps { users: Array<{ id: number; fullName: string }>; onClose?: () => void; }

const BADGES = [
  { value: 'GreatWork',     emoji: '🌟', label: 'Great Work' },
  { value: 'TeamPlayer',    emoji: '🤝', label: 'Team Player' },
  { value: 'ProblemSolver', emoji: '🔧', label: 'Problem Solver' },
  { value: 'Mentor',        emoji: '🎓', label: 'Mentor' },
  { value: 'Innovation',    emoji: '💡', label: 'Innovation' },
];

export const GiveKudosForm = ({ users, onClose }: KudosFormProps) => {
  const [toUserId, setToUserId] = useState<number | ''>('');
  const [badge, setBadge] = useState('GreatWork');
  const [message, setMessage] = useState('');
  const { toast } = useToast();
  const qc = useQueryClient();

  const give = useMutation({
    mutationFn: () => kudosApi.give({ toUserId: toUserId as number, message, badgeType: badge }),
    onSuccess: () => {
      toast.success('Kudos sent! 🎉 You made someone\'s day!');
      qc.invalidateQueries({ queryKey: ['kudosFeed'] });
      qc.invalidateQueries({ queryKey: ['myKudos'] });
      setToUserId('');
      setMessage('');
      onClose?.();
    },
    onError: (e: unknown) => toast.error((e as {response?: {data?: {message?: string}}}).response?.data?.message ?? 'Failed to send kudos')
  });

  return (
    <Card className="relative overflow-hidden">
      <div className="absolute -top-16 -right-16 w-40 h-40 bg-gradient-to-br from-amber-500/15 to-transparent rounded-full blur-2xl pointer-events-none" />
      <CardContent className="relative z-10">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Trophy className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Give Kudos</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Recognise a teammate's great work</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Teammate */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Teammate</label>
            <div className="relative">
              <select
                value={toUserId}
                onChange={e => setToUserId(+e.target.value)}
                className={`${INPUT_CLS} appearance-none pr-10 py-2.5 cursor-pointer`}
              >
                <option value="">Select teammate...</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Badge */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Badge</label>
            <div className="grid grid-cols-5 gap-1.5">
              {BADGES.map(b => {
                const active = badge === b.value;
                return (
                  <button
                    key={b.value}
                    type="button"
                    onClick={() => setBadge(b.value)}
                    title={b.label}
                    className={`flex flex-col items-center py-2.5 px-1 rounded-xl border transition ${
                      active
                        ? 'bg-amber-500/10 border-amber-500/50 ring-2 ring-amber-500/20'
                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <span className="text-xl">{b.emoji}</span>
                    <span className={`mt-1 text-[10px] font-medium leading-tight text-center ${
                      active ? 'text-amber-700 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'
                    }`}>
                      {b.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Message */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
              <MessageSquare className="w-3.5 h-3.5" /> Message
            </label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Write a message..."
              rows={3}
              className={`${INPUT_CLS} resize-none`}
            />
          </div>

          <button
            onClick={() => give.mutate()}
            disabled={!toUserId || !message.trim() || give.isPending}
            className="w-full inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold py-2.5 rounded-xl shadow-md shadow-amber-500/25 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {give.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trophy className="w-4 h-4" />}
            {give.isPending ? 'Sending…' : 'Send Kudos'}
          </button>
        </div>
      </CardContent>
    </Card>
  );
};
