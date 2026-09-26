// ─────────────────────────────────────────────────────────────────────────────
//  FILE: ui/src/pages/KudosPage.tsx
//  Kudos & Recognition - Modern Design System Upgrade
//
//  Logic unchanged from previous version:
//  ✅ My kudos summary (received / given / badge counts)
//  ✅ Leaderboard (this week / last 30 days / all time)
//  ✅ Give Kudos form (GiveKudosForm from Teamcomponents)
//  ✅ Recent feed (KudosFeed from Dashboardwidgets)
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { authApi, kudosApi } from '../services/api';
import { KudosFeed } from '../components/KudosFeed';
import { GiveKudosForm } from './Teamcomponents';
import type { KudosSummary, KudosLeaderboard, KudosLeaderboardEntry } from '../types';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Card, CardContent } from '../components/ui/Card';
import {
  Trophy,
  Gift,
  Megaphone,
  Heart,
  Send,
  Medal,
  Award,
  Sparkles,
  Crown,
} from 'lucide-react';

// ─── Badge config ──────────────────────────────────────────────────────────
const BADGES: Record<string, { emoji: string; label: string }> = {
  GreatWork:     { emoji: '🌟', label: 'Great Work'     },
  TeamPlayer:    { emoji: '🤝', label: 'Team Player'    },
  ProblemSolver: { emoji: '🔧', label: 'Problem Solver' },
  Mentor:        { emoji: '🎓', label: 'Mentor'         },
  Innovation:    { emoji: '💡', label: 'Innovation'     },
};

const RANK_STYLES: Record<number, { medal: string; ring: string; bg: string; text: string }> = {
  1: { medal: '🥇', ring: 'ring-amber-400',  bg: 'bg-gradient-to-r from-amber-500/15 to-transparent border-amber-500/30',   text: 'text-amber-600 dark:text-amber-400' },
  2: { medal: '🥈', ring: 'ring-slate-400',  bg: 'bg-gradient-to-r from-slate-400/15 to-transparent border-slate-400/30',   text: 'text-slate-600 dark:text-slate-300' },
  3: { medal: '🥉', ring: 'ring-orange-500', bg: 'bg-gradient-to-r from-orange-500/15 to-transparent border-orange-500/30', text: 'text-orange-600 dark:text-orange-400' },
};

// ─── Leaderboard Entry Card ────────────────────────────────────────────────
const LeaderboardCard = ({ entry }: { entry: KudosLeaderboardEntry }) => {
  const style  = RANK_STYLES[entry.rank];
  const isTop3 = entry.rank <= 3;

  return (
    <div
      className={`flex items-center gap-3 sm:gap-4 p-3.5 sm:p-4 rounded-2xl border transition-all ${
        isTop3
          ? style.bg
          : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
      }`}
    >
      <div className="w-9 sm:w-10 text-center flex-shrink-0">
        {isTop3
          ? <span className="text-2xl">{style.medal}</span>
          : <span className="text-base font-bold text-slate-400 dark:text-slate-500">#{entry.rank}</span>}
      </div>

      <div
        className={`w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-sm font-bold flex-shrink-0 text-white ${
          isTop3 ? `ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 ${style.ring}` : ''
        }`}
      >
        {entry.userName.charAt(0).toUpperCase()}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{entry.userName}</p>
          {entry.rank === 1 && <Crown className="w-4 h-4 text-amber-500 shrink-0" />}
          {entry.topBadge && (
            <span className="text-sm" title={BADGES[entry.topBadge]?.label}>{BADGES[entry.topBadge]?.emoji}</span>
          )}
        </div>
        <div className="flex flex-wrap gap-1 mt-1.5">
          {Object.entries(entry.badgeCounts).map(([badge, count]) => (
            <span
              key={badge}
              title={BADGES[badge]?.label ?? badge}
              className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
            >
              {BADGES[badge]?.emoji} ×{count}
            </span>
          ))}
        </div>
      </div>

      <div className="text-right flex-shrink-0">
        <p className={`text-2xl font-extrabold ${isTop3 ? style.text : 'text-slate-900 dark:text-white'}`}>{entry.totalReceived}</p>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">received</p>
        <p className="text-[11px] text-slate-400 dark:text-slate-500">gave {entry.totalGiven}</p>
      </div>
    </div>
  );
};

// ─── Leaderboard Section ──────────────────────────────────────────────────
type Period = 'week' | 'month' | 'alltime';

const LeaderboardSection = () => {
  const [period, setPeriod] = useState<Period>('month');

  const { data: leaderboard, isLoading } = useQuery<KudosLeaderboard>({
    queryKey: ['kudosLeaderboard', period],
    queryFn:  () => kudosApi.getLeaderboard(period).then(r => r.data),
  });

  const periods: Array<{ key: Period; label: string }> = [
    { key: 'week',    label: 'This Week'    },
    { key: 'month',   label: 'Last 30 Days' },
    { key: 'alltime', label: 'All Time'     },
  ];

  return (
    <Card>
      <CardContent>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <Trophy className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Kudos Leaderboard</h3>
              {leaderboard && <p className="text-xs text-slate-500 dark:text-slate-400">{leaderboard.periodLabel}</p>}
            </div>
          </div>
          <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-fit">
            {periods.map(p => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  period === p.key
                    ? 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2.5">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-slate-100 dark:bg-slate-800/60 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : !leaderboard?.entries.length ? (
          <div className="text-center py-12 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800">
            <Medal className="w-9 h-9 mx-auto text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-3">No kudos given in this period yet</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Be the first to recognise a teammate!</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {leaderboard.entries.map(entry => (
              <LeaderboardCard key={entry.userId} entry={entry} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ─── Main Page ─────────────────────────────────────────────────────────────
type Tab = 'leaderboard' | 'give' | 'feed';

export const KudosPage = () => {
  const [activeTab, setActiveTab] = useState<Tab>('leaderboard');

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn:  () => authApi.getUsers().then(r => r.data),
  });

  const { data: mySummary, isLoading: summaryLoading } = useQuery<KudosSummary>({
    queryKey: ['myKudos'],
    queryFn:  () => kudosApi.getMySummary().then(r => r.data),
  });

  const badgeEntries = Object.entries(mySummary?.badgeCounts ?? {}).sort((a, b) => b[1] - a[1]);
  const topBadge = badgeEntries[0];

  const tabs: Array<{ key: Tab; label: string; icon: React.ElementType }> = [
    { key: 'leaderboard', label: 'Leaderboard', icon: Trophy },
    { key: 'give',        label: 'Give Kudos',  icon: Gift },
    { key: 'feed',        label: 'Recent Feed', icon: Megaphone },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      {/* ── Page Header ── */}
      <PageHeader
        title="Kudos & Recognition"
        description="Celebrate your teammates and make someone's day!"
        breadcrumbs={[
          { label: 'Workspace', href: '/' },
          { label: 'Communication' },
          { label: 'Kudos' },
        ]}
        badge={{ label: 'Recognition', variant: 'amber', icon: <Sparkles className="w-3 h-3" /> }}
        actions={
          <button
            onClick={() => setActiveTab('give')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-amber-500 hover:bg-amber-400 text-white shadow-md shadow-amber-500/25 transition"
          >
            <Gift className="w-4 h-4" /> Give Kudos
          </button>
        }
        className="!mb-0"
      />

      {/* ── My summary ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Received"   value={mySummary?.totalReceived ?? 0} icon={Heart} color="amber"  loading={summaryLoading} />
        <StatCard title="Given"      value={mySummary?.totalGiven ?? 0}    icon={Send}  color="blue"   loading={summaryLoading} />
        <StatCard
          title="Top Badge"
          value={topBadge ? `${BADGES[topBadge[0]]?.emoji ?? '🏅'} ×${topBadge[1]}` : '—'}
          subtitle={topBadge ? BADGES[topBadge[0]]?.label ?? topBadge[0] : 'No badges yet'}
          icon={Award}
          color="purple"
          loading={summaryLoading}
        />
        <StatCard
          title="Badge Types"
          value={badgeEntries.length}
          subtitle={`of ${Object.keys(BADGES).length} collected`}
          icon={Medal}
          color="emerald"
          loading={summaryLoading}
        />
      </div>

      {badgeEntries.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {badgeEntries.map(([badge, count]) => (
            <span
              key={badge}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400"
            >
              {BADGES[badge]?.emoji} {BADGES[badge]?.label ?? badge} ×{count}
            </span>
          ))}
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="grid grid-cols-3 gap-1 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition ${
                activeTab === tab.key
                  ? 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'leaderboard' && <LeaderboardSection />}

      {activeTab === 'give' && (
        <div className="max-w-xl mx-auto">
          <GiveKudosForm users={users as Array<{ id: number; fullName: string }>} />
        </div>
      )}

      {activeTab === 'feed' && (
        <Card>
          <CardContent>
            <div className="flex items-center gap-2.5 mb-5">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                <Megaphone className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Recent Kudos</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Latest recognitions across the team</p>
              </div>
            </div>
            <KudosFeed />
          </CardContent>
        </Card>
      )}
    </div>
  );
};