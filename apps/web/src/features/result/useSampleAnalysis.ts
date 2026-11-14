import type { AnalysisResponse } from '@/lib/api/analyses';
import { fetchSample, type SampleId } from '@/lib/api/getSample';
import { skipToken, useQuery } from '@tanstack/react-query';

/** A static file: no polling, no retry (a missing file stays missing). */
export function useSampleAnalysis(sampleId: SampleId | null, locale: string) {
  return useQuery<AnalysisResponse>({
    queryKey: ['sample', sampleId, locale],
    queryFn: sampleId ? () => fetchSample({ sampleId, locale }) : skipToken,
    retry: false,
    staleTime: Infinity,
  });
}
