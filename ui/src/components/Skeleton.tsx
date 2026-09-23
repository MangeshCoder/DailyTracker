// ═══════════════════════════════════════════════════════════════════════════════
//  Feature 15: Skeleton Loaders
// ═══════════════════════════════════════════════════════════════════════════════
export const Skeleton = ({ className = '' }: { className?: string }) => (
  <div className={`animate-pulse bg-slate-800 rounded-xl ${className}`} />
);

export const SkeletonCard = () => (
  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
    <div className="flex items-center gap-3">
      <Skeleton className="w-10 h-10 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
    <Skeleton className="h-16" />
    <div className="grid grid-cols-3 gap-2">
      <Skeleton className="h-10" />
      <Skeleton className="h-10" />
      <Skeleton className="h-10" />
    </div>
  </div>
);

export const SkeletonDashboard = () => (
  <div className="p-6 space-y-6">
    <Skeleton className="h-8 w-56" />
    <div className="grid grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
    </div>
    <div className="grid grid-cols-2 gap-4">
      <Skeleton className="h-64 rounded-2xl" />
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  </div>
);