import { z } from 'zod';
import { ApiError, NetworkError } from './errors';

const errorBodySchema = z.object({ code: z.string() });

export async function deleteAnalysis(
  analysisId: string,
  deleteToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  let response: Response;
  try {
    response = await fetchImpl(`/api/analyses/${encodeURIComponent(analysisId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${deleteToken}` },
    });
  } catch {
    throw new NetworkError();
  }

  if (response.ok) return;

  const body: unknown = await response.json().catch(() => undefined);
  const error = errorBodySchema.safeParse(body);
  throw new ApiError(error.success ? error.data.code : 'INTERNAL', response.status);
}
