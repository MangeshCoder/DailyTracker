import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { authApi, kudosApi } from '../services/api';
import { KudosFeed } from './Dashboardwidgets';
import { GiveKudosForm } from './Teamcomponents';
import { KudosSummary, KudosLeaderboard, KudosLeaderboardEntry } from '../types';

// ─── Badge config ──────────────────────────────────────────────────────────
const BADGES: Record<string, { emoji: string; label: string }> = {
  GreatWork:     { emoji: '🌟', label: 'Great Work'     },
  TeamPlayer:    { emoji: '🤝', label: 'Team Player'    },
  ProblemSolver: { emoji: '🔧', label: 'Problem Solver' },
  Mentor:        { emoji: '🎓', label: 'Mentor'         },
  Innovation:    { emoji: '💡', label: 'Innovation'     },
};

const RANK_STYLES: Record<number, { medal: string; ring: string; bg: string }> = {
  1: { medal: '🥇', ring: 'ring-amber-400',  bg: 'from-amber-500/20 to-amber-500/5'  },
  2: { medal: '🥈', ring: 'ring-slate-400',  bg: 'from-slate-500/20 to-slate-500/5'  },
  3: { medal: '🥉', ring: 'ring-orange-500', bg: 'from-orange-500/20 to-orange-500/5' },
};

// ─── Leaderboard Entry Card ────────────────────────────────────────────────
const LeaderboardCard = ({ entry }: { entry: KudosLeaderboardEntry }) => {
  const style  = RANK_STYLES[entry.rank];
  const isTop3 = entry.rank <= 3;

  return (
    <div
      className={`flex items-center gap-4 p-4 rounded-2xl border transition-all
        ${isTop3
          ? `bg-gradient-to-r ${style.bg} border-slate-700`
          : 'bg-slate-800/40 border-slate-800 hover:bg-slate-800/60'
        }`}
    >
      {/* Rank */}
      <div className="w-10 text-center flex-shrink-0">
        {isTop3
          ? <span className="text-2xl">{style.medal}</span>
          : <span className="text-lg font-bold text-slate-500">#{entry.rank}</span>
        }
      </div>

      {/* Avatar */}
      <div
        className={`w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-violet-600
          flex items-center justify-center text-sm font-bold flex-shrink-0 text-white
          ${isTop3 ? `ring-2 ${style.ring}` : ''}`}
      >
        {entry.userName.charAt(0).toUpperCase()}
      </div>

      {/* Name, top badge, badge breakdown */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-white truncate">{entry.userName}</p>
          {entry.topBadge && (
            <span className="text-xs text-slate-400">
              {BADGES[entry.topBadge]?.emoji}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-1 mt-1.5">
          {Object.entries(entry.badgeCounts).map(([badge, count]) => (
            <span
              key={badge}
              className="text-xs bg-slate-700/60 px-2 py-0.5 rounded-full text-slate-400"
            >
              {BADGES[badge]?.emoji} ×{count}
            </span>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="text-right flex-shrink-0">
        <p className="text-2xl font-bold text-amber-400">{entry.totalReceived}</p>
        <p className="text-xs text-slate-500">received</p>
        <p className="text-xs text-slate-600 mt-0.5">gave {entry.totalGiven}</p>
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
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
      {/* Header + period toggle */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-white">🏆 Kudos Leaderboard</h3>
          {leaderboard && (
            <p className="text-xs text-slate-500 mt-0.5">{leaderboard.periodLabel}</p>
          )}
        </div>
        <div className="flex bg-slate-800 rounded-xl p-1 gap-1">
          {periods.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition
                ${period === p.key
                  ? 'bg-amber-500 text-slate-900'
                  : 'text-slate-400 hover:text-white'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Rankings */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-slate-800/50 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : !leaderboard?.entries.length ? (
        <div className="text-center py-12">
          <p className="text-4xl mb-2">🏅</p>
          <p className="text-slate-400 text-sm">No kudos given in this period yet.</p>
          <p className="text-slate-500 text-xs mt-1">Be the first to recognise a teammate!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {leaderboard.entries.map(entry => (
            <LeaderboardCard key={entry.userId} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
};

// ─── My Summary Section ────────────────────────────────────────────────────
const MySummarySection = ({ mySummary }: { mySummary?: KudosSummary }) => {
  if (!mySummary) return null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-6">
      <h3 className="text-sm font-semibold text-white mb-4">My Kudos Summary</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-slate-800/50 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-amber-400">{mySummary.totalReceived}</p>
          <p className="text-xs text-slate-500 mt-0.5">Received</p>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-blue-400">{mySummary.totalGiven}</p>
          <p className="text-xs text-slate-500 mt-0.5">Given</p>
        </div>
        {Object.entries(mySummary.badgeCounts).slice(0, 2).map(([badge, count]) => (
          <div key={badge} className="bg-slate-800/50 rounded-xl p-3 text-center">
            <p className="text-2xl">{BADGES[badge]?.emoji ?? '🏅'}</p>
            <p className="text-sm font-bold text-white">{count}</p>
            <p className="text-xs text-slate-500">{BADGES[badge]?.label ?? badge}</p>
          </div>
        ))}
      </div>
      {Object.keys(mySummary.badgeCounts).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(mySummary.badgeCounts).map(([badge, count]) => (
            <span
              key={badge}
              className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20
                         text-amber-400 px-3 py-1.5 rounded-xl text-xs font-medium"
            >
              {BADGES[badge]?.emoji} {BADGES[badge]?.label} ×{count}
            </span>
          ))}
        </div>
      )}
    </div>
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

  const { data: mySummary } = useQuery<KudosSummary>({
    queryKey: ['myKudos'],
    queryFn:  () => kudosApi.getMySummary().then(r => r.data),
  });

  const tabs: Array<{ key: Tab; label: string; icon: string }> = [
    { key: 'leaderboard', label: 'Leaderboard', icon: '🏆' },
    { key: 'give',        label: 'Give Kudos',  icon: '🎁' },
    { key: 'feed',        label: 'Recent Feed', icon: '📣' },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Kudos & Recognition 🏆</h1>
        <p className="text-slate-400 text-sm mt-1">Celebrate your teammates and make someone's day!</p>
      </div>

      <MySummarySection mySummary={mySummary} />

      {/* Tab bar */}
      <div className="flex gap-2 bg-slate-900 border border-slate-800 rounded-2xl p-1.5 mb-5">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition
              ${activeTab === tab.key
                ? 'bg-amber-500 text-slate-900'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'leaderboard' && <LeaderboardSection />}
      {activeTab === 'give' && (
        <GiveKudosForm users={users as Array<{ id: number; fullName: string }>} />
      )}
      {activeTab === 'feed' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">📣 Recent Kudos Feed</h3>
          <KudosFeed />
        </div>
      )}
    </div>
  );
};