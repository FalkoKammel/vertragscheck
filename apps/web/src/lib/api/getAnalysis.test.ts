import { describe, expect, it } from 'vitest';
import { analysisFixture } from '../../mocks/analysisFixtures';
import { ApiError, NetworkError } from './errors';
import { fetchAnalysis } from './getAnalysis';

function respond(status: number, body: unknown): typeof fetch {
  return () => Promise.resolve(new Response(JSON.stringify(body), { status }));
}

describe('fetchAnalysis', () => {
  it('requests the analysis by ID and returns the parsed response', async () => {
    const fixture = analysisFixture('running', 'a1');
    let url = '';
    const fetchImpl: typeof fetch = (input) => {
      url = typeof input === 'string' ? input : '';
      return Promise.resolve(Response.json(fixture));
    };

    await expect(fetchAnalysis({ analysisId: 'a1' }, fetchImpl)).resolves.toEqual(fixture);
    expect(url).toBe('/api/analyses/a1');
  });

  it('throws an ApiError with status and code on 404', async () => {
    const error = await fetchAnalysis(
      { analysisId: 'a1' },
      respond(404, { code: 'ANALYSIS_NOT_FOUND' }),
    ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: 'ANALYSIS_NOT_FOUND', status: 404 });
  });

  it('uses INTERNAL and the status when the error body is unreadable', async () => {
    const fetchImpl: typeof fetch = () => Promise.resolve(new Response('<html>', { status: 502 }));
    await expect(fetchAnalysis({ analysisId: 'a1' }, fetchImpl)).rejects.toMatchObject({
      code: 'INTERNAL',
      status: 502,
    });
  });

  it('throws a NetworkError when fetch fails', async () => {
    const fetchImpl: typeof fetch = () => Promise.reject(new TypeError('Failed to fetch'));
    await expect(fetchAnalysis({ analysisId: 'a1' }, fetchImpl)).rejects.toBeInstanceOf(
      NetworkError,
    );
  });

  it('treats an invalid success body as INTERNAL', async () => {
    await expect(
      fetchAnalysis({ analysisId: 'a1' }, respond(200, { id: 'a1', status: 'bogus' })),
    ).rejects.toEqual(new ApiError('INTERNAL'));
  });
});
