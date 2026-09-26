// ─────────────────────────────────────────────────────────────────────────────
//  FILE: ui/src/components/KudosFeed.tsx
//  Recent kudos list used on the Kudos page
// ─────────────────────────────────────────────────────────────────────────────

import { useQuery } from '@tanstack/react-query';
import { kudosApi } from '../services/api';
import {
  ArrowRight,
  PartyPopper,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
//  Kudos Feed (list only — the Kudos page provides the card + title)
// ═══════════════════════════════════════════════════════════════════════════════

const BADGE_EMOJI: Record<string, string> = {
  GreatWork: '🌟', TeamPlayer: '🤝', ProblemSolver: '🔧',
  Mentor: '🎓', Innovation: '💡'
};

export const KudosFeed = () => {
  const { data: kudos, isLoading } = useQuery<any[]>({
    queryKey: ['kudosFeed'],
    queryFn: () => kudosApi.getRecent(10).then(r => r.data),
  });

  if (isLoading) {
    return (
      <div className="space-y-2.5">
        {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl bg-slate-100 dark:bg-slate-800/60 animate-pulse" />)}
      </div>
    );
  }

  if (!kudos || kudos.length === 0) {
    return (
      <div className="text-center py-10 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800">
        <PartyPopper className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-2">No kudos yet</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Be the first to give one!</p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {kudos.map((k: any) => (
        <div
          key={k.id}
          className="flex gap-3 items-start p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-xl flex-shrink-0">
            {BADGE_EMOJI[k.badgeType] ?? '🌟'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="flex flex-wrap items-center gap-1.5 text-sm">
              <span className="font-bold text-blue-600 dark:text-blue-400">{k.fromUserName}</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-bold text-emerald-600 dark:text-emerald-400">{k.toUserName}</span>
            </p>
            <p className="text-sm text-slate-700 dark:text-slate-300 mt-1 line-clamp-2">{k.message}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
              {k.badgeType} · {new Date(k.givenAt).toLocaleDateString('en-GB')}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};
