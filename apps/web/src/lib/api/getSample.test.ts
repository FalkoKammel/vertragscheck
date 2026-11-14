import { describe, expect, it } from 'vitest';
import { analysisFixture } from '../../mocks/analysisFixtures';
import { ApiError, NetworkError } from './errors';
import { fetchSample, isSampleId } from './getSample';

const reply =
  (response: Response): typeof fetch =>
  () =>
    Promise.resolve(response);

describe('isSampleId', () => {
  it('accepts only the known samples', () => {
    expect(isSampleId('sample-rental')).toBe(true);
    expect(isSampleId('sample-employment')).toBe(true);
    expect(isSampleId('sample-../x')).toBe(false);
  });
});

describe('fetchSample', () => {
  it('requests the file for the locale and parses it', async () => {
    const fixture = analysisFixture('done', 'sample-rental');
    let url = '';
    const fetchImpl: typeof fetch = (input) => {
      url = typeof input === 'string' ? input : '';
      return Promise.resolve(Response.json(fixture));
    };
    await expect(
      fetchSample({ sampleId: 'sample-rental', locale: 'en' }, fetchImpl),
    ).resolves.toEqual(fixture);
    expect(url).toBe('/samples/sample-rental.en.json');
  });

  it('treats a 404 and a non-JSON body as not found', async () => {
    const input = { sampleId: 'sample-rental', locale: 'de' } as const;
    for (const res of [
      new Response('', { status: 404 }),
      new Response('<html>', { status: 200 }),
    ]) {
      await expect(fetchSample(input, reply(res))).rejects.toMatchObject({
        status: 404,
        code: 'ANALYSIS_NOT_FOUND',
      });
    }
  });

  it('rejects a file that is not a valid response', async () => {
    const error = await fetchSample(
      { sampleId: 'sample-rental', locale: 'de' },
      reply(Response.json({ id: 1 })),
    ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
  });

  it('maps a failed request to a NetworkError', async () => {
    const failing: typeof fetch = () => Promise.reject(new TypeError('offline'));
    await expect(
      fetchSample({ sampleId: 'sample-rental', locale: 'de' }, failing),
    ).rejects.toBeInstanceOf(NetworkError);
  });
});
