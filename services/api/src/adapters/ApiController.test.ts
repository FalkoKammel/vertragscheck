import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GetAnalysisOutput } from '../application/GetAnalysis';
import { Analysis } from '../domain/analysis';
import { AnalysisNotFoundError } from '../domain/DomainError';
import { ApiController } from './ApiController';

const ID = '3f9c2b7e-5d41-4a8e-9b0c-1d2e3f4a5b6c';

function analysis() {
  return new Analysis({
    id: ID,
    status: 'running',
    contractType: 'rental',
    language: 'de',
    createdAt: new Date('2026-11-03T10:00:00Z'),
    startedAt: new Date('2026-11-03T10:01:00Z'),
    expiresAt: new Date('2026-12-03T10:00:00Z'),
    deleteTokenHash: 'secret-hash',
  });
}

function setup(getsAnalysis: (id: string) => Promise<GetAnalysisOutput> | GetAnalysisOutput) {
  const reads: string[] = [];
  const controller = new ApiController({
    requestsUpload: { execute: () => Promise.reject(new Error('not used')) },
    getsAnalysis: {
      execute: ({ analysisId }) => {
        reads.push(analysisId);
        return getsAnalysis(analysisId);
      },
    },
  });
  const get = (id: string | undefined) =>
    controller.handle({
      routeKey: 'GET /api/analyses/{id}',
      pathParameters: id === undefined ? undefined : { id },
      headers: {},
      requestContext: { http: { sourceIp: '203.0.113.7' } },
    } as unknown as APIGatewayProxyEventV2);
  return { get, reads };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /api/analyses/{id}', () => {
  it('returns the analysis with Cache-Control no-store', async () => {
    const { get } = setup(() => ({ analysis: analysis(), status: 'running' }));
    const res = await get(ID);
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(JSON.parse(res.body)).toMatchObject({ id: ID, status: 'running' });
    expect(res.body).not.toContain('secret-hash');
  });

  it.each(['abc', '../etc/passwd', '3f9c2b7e', `${ID}x`, ''])(
    'answers 404 for the invalid id %j without calling the use case',
    async (id) => {
      const { get, reads } = setup(() => Promise.reject(new Error('not used')));
      const res = await get(id);
      expect(res.statusCode).toBe(404);
      expect(JSON.parse(res.body)).toEqual({ code: 'ANALYSIS_NOT_FOUND' });
      expect(res.headers['cache-control']).toBe('no-store');
      expect(reads).toEqual([]);
    },
  );

  it('answers 404 for a missing id parameter', async () => {
    const res = await setup(() => Promise.reject(new Error('not used'))).get(undefined);
    expect(res.statusCode).toBe(404);
  });

  it('answers 404 for an unknown or expired analysis, with the same body', async () => {
    const { get } = setup(() => Promise.reject(new AnalysisNotFoundError()));
    const res = await get(ID);
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body)).toEqual({ code: 'ANALYSIS_NOT_FOUND' });
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('answers 500 INTERNAL for unexpected errors, with no-store', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = await setup(() => Promise.reject(new Error('boom'))).get(ID);
    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body)).toEqual({ code: 'INTERNAL' });
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('logs only the id and the status', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const done = analysis();
    await setup(() => ({ analysis: done, status: 'done', text: 'GEHEIMER VERTRAGSTEXT' })).get(ID);
    expect(log).toHaveBeenCalledTimes(1);
    const line = String(log.mock.calls[0]?.[0]);
    expect(JSON.parse(line)).toEqual({ msg: 'analysis read', id: ID, status: 'done' });
    expect(line).not.toContain('GEHEIMER');
  });
});
