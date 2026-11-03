import { describe, expect, it } from 'vitest';
import { ApiError, NetworkError } from './errors';
import { requestUpload } from './uploads';

const input = { captchaToken: 'tok', contractType: 'rental', language: 'de' } as const;

const success = {
  analysisId: 'abc',
  deleteToken: 'del',
  uploadTicket: { url: 'https://bucket.s3.eu-central-1.amazonaws.com/', fields: { key: 'k' } },
};

function respond(status: number, body: unknown): typeof fetch {
  return () => Promise.resolve(new Response(JSON.stringify(body), { status }));
}

describe('requestUpload', () => {
  it('posts the input as JSON and returns the validated response', async () => {
    let seen: { url: string; init: RequestInit | undefined } | undefined;
    const fetchImpl: typeof fetch = (url, init) => {
      seen = { url: typeof url === 'string' ? url : '', init };
      return Promise.resolve(new Response(JSON.stringify(success), { status: 201 }));
    };

    await expect(requestUpload(input, fetchImpl)).resolves.toEqual(success);
    expect(seen?.url).toBe('/api/uploads');
    expect(seen?.init?.method).toBe('POST');
    expect(JSON.parse(typeof seen?.init?.body === 'string' ? seen.init.body : '')).toEqual(input);
  });

  it('throws an ApiError with the code from the error body', async () => {
    await expect(
      requestUpload(input, respond(429, { code: 'DAILY_LIMIT_REACHED' })),
    ).rejects.toMatchObject({ name: 'ApiError', code: 'DAILY_LIMIT_REACHED' });
  });

  it('uses INTERNAL when the error body is unreadable', async () => {
    const fetchImpl: typeof fetch = () => Promise.resolve(new Response('<html>', { status: 502 }));
    await expect(requestUpload(input, fetchImpl)).rejects.toEqual(new ApiError('INTERNAL'));
  });

  it('treats a malformed success body as INTERNAL', async () => {
    await expect(requestUpload(input, respond(201, { analysisId: 'abc' }))).rejects.toEqual(
      new ApiError('INTERNAL'),
    );
  });

  it('throws a NetworkError when fetch fails', async () => {
    const fetchImpl: typeof fetch = () => Promise.reject(new TypeError('Failed to fetch'));
    await expect(requestUpload(input, fetchImpl)).rejects.toBeInstanceOf(NetworkError);
  });
});
