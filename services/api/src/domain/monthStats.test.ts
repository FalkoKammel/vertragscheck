import { describe, expect, it } from 'vitest';
import { aggregateMonthStats, percentile95, type MonthAnalysisSummary } from './monthStats';

function done(over: Partial<MonthAnalysisSummary> = {}): MonthAnalysisSummary {
  return {
    status: 'done',
    costMicroUsd: 10_000,
    latencyMs: 1000,
    clauseCount: 9,
    unverifiedQuotes: 1,
    invalidClauses: 0,
    ...over,
  };
}

describe('aggregateMonthStats', () => {
  it('returns empty figures for an empty month', () => {
    expect(aggregateMonthStats([])).toEqual({
      done: 0,
      failed: 0,
      meanCostMicroUsd: null,
      p95LatencyMs: null,
      unverifiedQuotes: { num: 0, den: 0 },
    });
  });

  it('counts failed analyses but excludes them from cost, duration and quotes', () => {
    const stats = aggregateMonthStats([
      done({ costMicroUsd: 20_000, latencyMs: 2000 }),
      done({ costMicroUsd: 40_000, latencyMs: 4000 }),
      {
        status: 'failed',
        costMicroUsd: 999_999,
        latencyMs: 999_999,
        clauseCount: 0,
        unverifiedQuotes: 50,
        invalidClauses: 0,
      },
    ]);
    expect(stats.done).toBe(2);
    expect(stats.failed).toBe(1);
    expect(stats.meanCostMicroUsd).toBe(30_000);
    expect(stats.p95LatencyMs).toBe(4000);
    expect(stats.unverifiedQuotes).toEqual({ num: 2, den: 20 });
  });

  it('ignores analyses that are still pending or running', () => {
    const stats = aggregateMonthStats([
      { ...done(), status: 'running' },
      { ...done(), status: 'pending_upload' },
    ]);
    expect(stats.done).toBe(0);
    expect(stats.failed).toBe(0);
    expect(stats.meanCostMicroUsd).toBeNull();
  });

  it('counts invalid clauses in the denominator of the quote share', () => {
    const stats = aggregateMonthStats([
      done({ clauseCount: 8, unverifiedQuotes: 1, invalidClauses: 1 }),
    ]);
    expect(stats.unverifiedQuotes).toEqual({ num: 1, den: 10 });
  });

  it('skips done analyses without a run for cost and duration', () => {
    const stats = aggregateMonthStats([
      done({ costMicroUsd: undefined, latencyMs: undefined }),
      done({ costMicroUsd: 8000, latencyMs: 500 }),
    ]);
    expect(stats.done).toBe(2);
    expect(stats.meanCostMicroUsd).toBe(8000);
    expect(stats.p95LatencyMs).toBe(500);
  });
});

describe('percentile95', () => {
  it('is null without values', () => {
    expect(percentile95([])).toBeNull();
  });
  it('is the only value for one value', () => {
    expect(percentile95([7])).toBe(7);
  });
  it('uses nearest rank: 20 values give the 19th', () => {
    const values = Array.from({ length: 20 }, (_, i) => (i + 1) * 100).reverse();
    expect(percentile95(values)).toBe(1900);
  });
  it('21 values give the 20th', () => {
    const values = Array.from({ length: 21 }, (_, i) => i + 1);
    expect(percentile95(values)).toBe(20);
  });
});
