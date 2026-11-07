import { describe, expect, it } from 'vitest';
import { Analysis, type ModelRun } from './analysis';
import { InvalidStatusTransitionError } from './DomainError';

const RUN: ModelRun = {
  modelId: 'model-1',
  promptVersion: 'v1',
  usage: { inputTokens: 10, outputTokens: 5 },
  costMicroUsd: 42,
  latencyMs: 800,
};

function running() {
  return new Analysis({
    id: 'a1',
    status: 'running',
    contractType: 'rental',
    language: 'de',
    createdAt: new Date('2026-11-03T10:00:00Z'),
    expiresAt: new Date('2026-12-03T10:00:00Z'),
    deleteTokenHash: 'hash',
  });
}

describe('Analysis', () => {
  it('has no run and zero drop counters by default', () => {
    const a = running();
    expect(a.run).toBeUndefined();
    expect(a.unverifiedQuotes).toBe(0);
    expect(a.invalidClauses).toBe(0);
  });

  it('complete stores clauses, both drop counters and the run', () => {
    const a = running();
    a.complete({ verification: { clauses: [], unverifiedQuotes: 2 }, invalidClauses: 3, run: RUN });
    expect(a.status).toBe('done');
    expect(a.unverifiedQuotes).toBe(2);
    expect(a.invalidClauses).toBe(3);
    expect(a.run).toEqual(RUN);
  });

  it('fail stores the reason and the run', () => {
    const a = running();
    a.fail('LLM_INVALID_OUTPUT', RUN);
    expect(a.status).toBe('failed');
    expect(a.failureReason).toBe('LLM_INVALID_OUTPUT');
    expect(a.run).toEqual(RUN);
  });

  it('fail without a run leaves run undefined', () => {
    const a = running();
    a.fail('NO_TEXT_LAYER');
    expect(a.run).toBeUndefined();
  });

  it('only completes or fails from running', () => {
    const a = running();
    a.fail('INTERNAL');
    expect(() => {
      a.complete({
        verification: { clauses: [], unverifiedQuotes: 0 },
        invalidClauses: 0,
        run: RUN,
      });
    }).toThrow(InvalidStatusTransitionError);
    expect(() => {
      a.fail('INTERNAL');
    }).toThrow(InvalidStatusTransitionError);
  });

  it('round-trips through toProps', () => {
    const a = running();
    a.complete({ verification: { clauses: [], unverifiedQuotes: 1 }, invalidClauses: 2, run: RUN });
    expect(new Analysis(a.toProps())).toEqual(a);
  });
});
