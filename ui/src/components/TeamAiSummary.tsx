// ─────────────────────────────────────────────────────────────────────────────
//  AI team summary (Manager Dashboard → "AI Summary", 7 Oct 2026)
//  The server counts each person's numbers from attendance and EOD reports;
//  Gemini writes the overview / highlights / blockers / who needs attention.
//  Without AI the server puts a plain summary together, and the card says so.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { AlertTriangle, CheckCircle2, HeartPulse, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { aiChatApi } from '../services/api';
import type { TeamSummary } from '../types';
import { Card, CardContent } from './ui/Card';

const PERIODS = [7, 14, 30] as const;

const hm = (mins: number) => `${Math.floor(mins / 60)}h ${mins % 60}m`;
const day = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

const MOOD_TONE: Record<string, string> = {
  Great: 'text-emerald-600 dark:text-emerald-400',
  Good: 'text-emerald-600 dark:text-emerald-400',
  Okay: 'text-slate-600 dark:text-slate-300',
  Tired: 'text-amber-600 dark:text-amber-400',
  Stressed: 'text-rose-600 dark:text-rose-400',
};

function PointList({ title, icon: Icon, tone, items, empty }: {
  title: string; icon: React.ElementType; tone: string; items: string[]; empty: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2.5">
      <p className={`flex items-center gap-2 text-sm font-bold ${tone}`}>
        <Icon className="w-4 h-4 shrink-0" /> {title}
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">{empty}</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((t, i) => (
            <li key={i} className="flex gap-2 text-sm text-slate-700 dark:text-slate-300 leading-snug">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-current opacity-40 shrink-0" />
              <span className="min-w-0 break-words">{t}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function TeamAiSummary() {
  const [days, setDays] = useState<number>(7);
  const [summary, setSummary] = useState<TeamSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async (period = days) => {
    setLoading(true);
    setError(null);
    try {
      setSummary((await aiChatApi.getTeamSummary(period)).data);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Could not make the summary. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const pickPeriod = (d: number) => {
    setDays(d);
    if (summary) generate(d);   // already looking at one: refresh for the new period
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="!py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
              <Sparkles className="w-4 h-4 text-amber-500 shrink-0" /> AI Team Summary
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Reads your team’s EOD reports and attendance, and tells you how the period went.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700" role="group" aria-label="Period">
              {PERIODS.map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => pickPeriod(d)}
                  disabled={loading}
                  aria-pressed={days === d}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                    days === d
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Last {d} days
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => generate()}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-500/20 transition disabled:opacity-60"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : summary ? <RefreshCw className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
              {loading ? 'Reading reports…' : summary ? 'Refresh' : 'Generate summary'}
            </button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">{error}</div>
      )}

      {!summary && !error && !loading && (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-sm text-slate-500 dark:text-slate-400">
          Pick a period and click <strong className="text-slate-700 dark:text-slate-200">Generate summary</strong>.
        </div>
      )}

      {summary && (
        <div className="space-y-5" data-testid="team-summary">
          {/* Overview */}
          <Card>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${
                  summary.source === 'ai'
                    ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
                    : 'bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/20'
                }`}>
                  {summary.source === 'ai' ? <><Sparkles className="w-3 h-3" /> Written by AI</> : 'Summary from the numbers (AI not available)'}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {day(summary.from)} – {day(summary.to)} · {summary.people.length} {summary.people.length === 1 ? 'person' : 'people'}
                </span>
              </div>
              <p className="text-sm sm:text-base leading-relaxed text-slate-800 dark:text-slate-100">{summary.overview}</p>
              {summary.source === 'ai' && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  AI can get things wrong — check with the person before acting. The numbers below are counted from attendance and EOD reports.
                </p>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <PointList title="Highlights" icon={CheckCircle2} tone="text-emerald-600 dark:text-emerald-400"
                       items={summary.highlights} empty="No completed work reported yet." />
            <PointList title="Blockers" icon={AlertTriangle} tone="text-amber-600 dark:text-amber-400"
                       items={summary.blockers} empty="No blockers reported." />
            <PointList title="Needs attention" icon={HeartPulse} tone="text-rose-600 dark:text-rose-400"
                       items={summary.needsAttention} empty="Nothing to flag." />
          </div>

          {/* Numbers per person — counted by the server, not by the AI */}
          {summary.people.length > 0 && (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                      <th className="px-4 py-3 font-semibold">Person</th>
                      <th className="px-3 py-3 font-semibold whitespace-nowrap">Days</th>
                      <th className="px-3 py-3 font-semibold whitespace-nowrap">Hours</th>
                      <th className="px-3 py-3 font-semibold whitespace-nowrap">Tasks done</th>
                      <th className="px-3 py-3 font-semibold whitespace-nowrap">EOD reports</th>
                      <th className="px-3 py-3 font-semibold whitespace-nowrap">Last mood</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {summary.people.map(p => (
                      <tr key={p.userId} data-testid={`summary-person-${p.userId}`}>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900 dark:text-white whitespace-nowrap">{p.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{p.role}</p>
                        </td>
                        <td className="px-3 py-3 text-slate-700 dark:text-slate-300">{p.daysWorked}</td>
                        <td className="px-3 py-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">{hm(p.workMinutes)}</td>
                        <td className="px-3 py-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {p.tasksCompleted}
                          {p.tasksBlocked > 0 && <span className="ml-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">{p.tasksBlocked} blocked</span>}
                        </td>
                        <td className="px-3 py-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {p.eodsSubmitted}
                          {p.eodsMissing > 0 && <span className="ml-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400">{p.eodsMissing} missing</span>}
                        </td>
                        <td className={`px-3 py-3 font-semibold whitespace-nowrap ${MOOD_TONE[p.lastMood ?? ''] ?? 'text-slate-400'}`}>
                          {p.lastMood ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
