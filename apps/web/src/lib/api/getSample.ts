import { analysisResponseSchema, type AnalysisResponse } from './analyses';
import { ApiError, NetworkError } from './errors';

/** Sample analyses are static files in /samples, generated offline by `pnpm --filter eval samples`. */
export const SAMPLE_IDS = ['sample-rental', 'sample-employment'] as const;
export type SampleId = (typeof SAMPLE_IDS)[number];

export function isSampleId(id: string): id is SampleId {
  return (SAMPLE_IDS as readonly string[]).includes(id);
}

export async function fetchSample(
  input: { sampleId: SampleId; locale: string },
  fetchImpl: typeof fetch = fetch,
): Promise<AnalysisResponse> {
  let response: Response;
  try {
    response = await fetchImpl(`/samples/${input.sampleId}.${input.locale}.json`);
  } catch {
    throw new NetworkError();
  }
  if (response.status === 404) throw new ApiError('ANALYSIS_NOT_FOUND', 404);
  if (!response.ok) throw new ApiError('INTERNAL', response.status);

  // A host that answers a missing file with an HTML page is treated like a missing file.
  const body: unknown = await response.json().catch(() => undefined);
  if (body === undefined) throw new ApiError('ANALYSIS_NOT_FOUND', 404);
  const parsed = analysisResponseSchema.safeParse(body);
  if (!parsed.success) throw new ApiError('INTERNAL');
  return parsed.data;
}
