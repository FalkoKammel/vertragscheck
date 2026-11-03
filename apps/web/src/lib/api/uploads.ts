import { z } from 'zod';
import { ApiError, NetworkError } from './errors';

export type ContractType = 'rental' | 'employment';
export type Language = 'de' | 'en';

export interface RequestUploadInput {
  captchaToken: string;
  contractType: ContractType;
  language: Language;
}

const uploadResponseSchema = z.object({
  analysisId: z.string().min(1),
  deleteToken: z.string().min(1),
  uploadTicket: z.object({
    url: z.url(),
    fields: z.record(z.string(), z.string()),
  }),
});

export type UploadResponse = z.infer<typeof uploadResponseSchema>;
export type UploadTicket = UploadResponse['uploadTicket'];

const errorBodySchema = z.object({ code: z.string() });

export async function requestUpload(
  input: RequestUploadInput,
  fetchImpl: typeof fetch = fetch,
): Promise<UploadResponse> {
  let response: Response;
  try {
    response = await fetchImpl('/api/uploads', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
  } catch {
    throw new NetworkError();
  }

  const body: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    const error = errorBodySchema.safeParse(body);
    throw new ApiError(error.success ? error.data.code : 'INTERNAL');
  }

  const parsed = uploadResponseSchema.safeParse(body);
  if (!parsed.success) throw new ApiError('INTERNAL');
  return parsed.data;
}
