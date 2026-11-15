import { describe, expect, it } from 'vitest';
import { buildModelComparison, modelComparison } from './evalModels';

const entry = (model: string, over: Record<string, unknown> = {}) => ({
  model,
  promptVersion: 'v1',
  runs: 3,
  contracts: 8,
  summary: {
    recall: { num: 102, den: 111 },
    falseAlarmRate: { num: 6, den: 105 },
    costMicroUsd: { mean: 48_000 },
    latencyMs: { p95: 26_000 },
  },
  ...over,
});

describe('buildModelComparison', () => {
  it('divides counts by the number of runs', () => {
    const { rows } = buildModelComparison({ a: entry('a') });
    expect(rows[0]).toMatchObject({
      found: { num: 34, den: 37 },
      falseAlarms: { num: 2, den: 35 },
    });
  });

  it('skips entries stored under a suffixed key (reverified runs)', () => {
    const { rows } = buildModelComparison({ a: entry('a'), 'a-reverified': entry('a') });
    expect(rows.map((r) => r.modelId)).toEqual(['a']);
  });

  it('rejects a file of the wrong shape', () => {
    expect(() => buildModelComparison({ a: { model: 'a' } })).toThrow();
  });
});

describe('committed eval/summary.json', () => {
  it('lists the models that have an entry and the size of the test set', () => {
    expect(modelComparison.contracts).toBe(8);
    const ids = modelComparison.rows.map((r) => r.modelId);
    expect(ids).toContain('eu.anthropic.claude-sonnet-4-6');
    expect(ids).toContain('eu.anthropic.claude-haiku-4-5-20251001-v1:0');
    expect(ids.some((id) => id.includes('reverified'))).toBe(false);
  });

  it('shows 34/37 found for Sonnet', () => {
    const sonnet = modelComparison.rows.find((r) => r.modelId === 'eu.anthropic.claude-sonnet-4-6');
    expect(sonnet?.found).toEqual({ num: 34, den: 37 });
  });
});
