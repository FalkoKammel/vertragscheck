import { describe, expect, it, vi } from 'vitest';
import { ApiError, NetworkError } from './errors';
import { fetchStats } from './getStats';

const body = {
  month: '2026-11',
  analyses: { done: 4, failed: 1 },
  meanCostMicroUsd: 48_000,
  p95LatencyMs: 26_000,
  unverifiedQuotes: { num: 1, den: 52 },
  budget: { spentMicroUsd: 2_400_000, limitMicroUsd: 10_000_000 },
  activeModelId: 'eu.anthropic.claude-sonnet-4-6',
};

describe('fetchStats', () => {
  it('requests /api/stats and returns the parsed figures', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(Response.json(body)));
    expect(await fetchStats(fetchImpl)).toEqual(body);
    expect(fetchImpl).toHaveBeenCalledWith('/api/stats', { method: 'GET' });
  });

  it('accepts an empty month with null figures', async () => {
    const empty = {
      ...body,
      analyses: { done: 0, failed: 0 },
      meanCostMicroUsd: null,
      p95LatencyMs: null,
    };
    expect(
      (await fetchStats(() => Promise.resolve(Response.json(empty)))).meanCostMicroUsd,
    ).toBeNull();
  });

  it('rejects a body of the wrong shape', async () => {
    await expect(
      fetchStats(() => Promise.resolve(Response.json({ month: 1 }))),
    ).rejects.toMatchObject({
      code: 'INTERNAL',
    });
  });

  it('turns an error body into an ApiError with code and status', async () => {
    const error = await fetchStats(() =>
      Promise.resolve(Response.json({ code: 'INTERNAL' }, { status: 500 })),
    ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: 'INTERNAL', status: 500 });
  });

  it('turns a failed request into a NetworkError', async () => {
    await expect(
      fetchStats(() => Promise.reject(new TypeError('Failed to fetch'))),
    ).rejects.toBeInstanceOf(NetworkError);
  });
});
