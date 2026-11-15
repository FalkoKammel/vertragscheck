import { useQuery } from '@tanstack/react-query';
import { fetchStats, type StatsResponse } from '@/lib/api/getStats';

const FIVE_MINUTES = 5 * 60 * 1000;

export function useStats() {
  return useQuery<StatsResponse>({
    queryKey: ['stats'],
    queryFn: () => fetchStats(),
    staleTime: FIVE_MINUTES,
    retry: 1,
  });
}
