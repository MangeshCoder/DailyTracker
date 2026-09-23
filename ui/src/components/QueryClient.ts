import { QueryClient } from '@tanstack/react-query';

// ─── Feature 12: React Query Client ──────────────────────────────────────────
// Caches all API responses, auto-refetches stale data, handles loading/error states.
// Usage in component: const { data, isLoading } = useQuery({ queryKey: ['goals'], queryFn: () => goalsApi.getProgress().then(r => r.data) })

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,          // 30s – data considered fresh, won't refetch
      gcTime: 5 * 60_000,         // 5min – keep in cache even if unused
      retry: 1,                   // Retry once on failure
      refetchOnWindowFocus: true, // Refresh when user tabs back
      refetchOnReconnect: true,   // Refresh on internet reconnect
    },
    mutations: {
      retry: 0,
    },
  },
});