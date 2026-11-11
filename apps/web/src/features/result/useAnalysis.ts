import type { AnalysisResponse } from '@/lib/api/analyses';
import { ApiError } from '@/lib/api/errors';
import { fetchAnalysis } from '@/lib/api/getAnalysis';
import { skipToken, useQuery } from '@tanstack/react-query';

export function useAnalysis(id: string | null) {
  return useQuery<AnalysisResponse>({
    queryKey: ['analysis', id],
    queryFn: id ? () => fetchAnalysis({ analysisId: id }) : skipToken,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'pending_upload' || status === 'running' ? 2000 : false;
    },
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 404) return false;
      return failureCount < 3;
    },
  });
}
