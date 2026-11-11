import { z } from 'zod';
import type { AnalysisResponse } from './analyses';
import { analysisResponseSchema } from './analyses';
import { NetworkError, ApiError } from './errors';

export interface GetsAnalysisInput {
  analysisId: string;
}

const errorBodySchema = z.object({ code: z.string() });

export async function fetchAnalysis(
  input: GetsAnalysisInput,
  fetchImpl: typeof fetch = fetch,
): Promise<AnalysisResponse> {
  let response: Response;
  try {
    response = await fetchImpl(`/api/analyses/${encodeURIComponent(input.analysisId)}`, {
      method: 'GET',
    });
  } catch {
    throw new NetworkError();
  }

  const body: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    const error = errorBodySchema.safeParse(body);
    throw new ApiError(error.success ? error.data.code : 'INTERNAL', response.status);
  }

  const parsed = analysisResponseSchema.safeParse(body);
  if (!parsed.success) throw new ApiError('INTERNAL');
  return parsed.data;
}
