import { z } from 'zod';
import { ApiError, NetworkError } from './errors';

const ratioSchema = z.object({
  num: z.number().int().nonnegative(),
  den: z.number().int().nonnegative(),
});

export const statsResponseSchema = z.object({
  month: z.string(),
  analyses: z.object({
    done: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
  }),
  meanCostMicroUsd: z.number().nonnegative().nullable(),
  p95LatencyMs: z.number().nonnegative().nullable(),
  unverifiedQuotes: ratioSchema,
  budget: z.object({
    spentMicroUsd: z.number().nonnegative(),
    limitMicroUsd: z.number().positive(),
  }),
  activeModelId: z.string(),
});

export type StatsResponse = z.infer<typeof statsResponseSchema>;

const errorBodySchema = z.object({ code: z.string() });

export async function fetchStats(fetchImpl: typeof fetch = fetch): Promise<StatsResponse> {
  let response: Response;
  try {
    response = await fetchImpl('/api/stats', { method: 'GET' });
  } catch {
    throw new NetworkError();
  }

  const body: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    const error = errorBodySchema.safeParse(body);
    throw new ApiError(error.success ? error.data.code : 'INTERNAL', response.status);
  }

  const parsed = statsResponseSchema.safeParse(body);
  if (!parsed.success) throw new ApiError('INTERNAL');
  return parsed.data;
}
