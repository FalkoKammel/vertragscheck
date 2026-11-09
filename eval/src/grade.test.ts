import { ContractText } from 'api/src/domain/ContractText';
import type { StoredClause } from 'api/src/domain/schemas';
import { describe, expect, it } from 'vitest';
import { grade, overlaps, percentile95 } from './grade';
import type { Contract } from './load';
import type { CallRecord } from './results.schema';

const contract: Contract = {
  id: 'rental-01',
  contractType: 'rental',
  description: 'd',
  text: ContractText.fromExtracted(['x']),
  expected: [
    {
      id: 'rental-01-a',
      anchor: 'a',
      category: 'rent',
      level: 'critical',
      acceptLevels: ['check'],
      note: 'n',
      start: 100,
      end: 200,
    },
    {
      id: 'rental-01-b',
      anchor: 'b',
      category: 'pets',
      level: 'check',
      acceptLevels: [],
      note: 'n',
      start: 300,
      end: 400,
    },
  ],
  clean: [{ anchor: 'c', start: 500, end: 600 }],
};

function clause(
  start: number,
  end: number,
  level: StoredClause['level'],
  category = 'rent',
): StoredClause {
  return {
    category: category as StoredClause['category'],
    level,
    quote: 'q',
    reason: 'r',
    start,
    end,
  };
}

function call(run: number, clauses: StoredClause[], extra: Partial<CallRecord> = {}): CallRecord {
  return {
    contractId: 'rental-01',
    run,
    result: {
      ok: true,
      modelId: 'm',
      promptVersion: 'v1',
      usage: { inputTokens: 1, outputTokens: 1 },
      latencyMs: 100,
      clauses: [],
      invalidClauses: 0,
    },
    verification: { clauses, unverifiedQuotes: 0 },
    costMicroUsd: 1000,
    ...extra,
  };
}

describe('overlaps', () => {
  it('counts partial overlap but not touching spans', () => {
    expect(overlaps({ start: 0, end: 10 }, { start: 5, end: 15 })).toBe(true);
    expect(overlaps({ start: 0, end: 10 }, { start: 10, end: 20 })).toBe(false);
    expect(overlaps({ start: 10, end: 20 }, { start: 0, end: 10 })).toBe(false);
  });
});

describe('grade', () => {
  it('accepts acceptLevels and judges level and category', () => {
    const g = grade(
      [contract],
      [call(1, [clause(150, 160, 'check', 'rent'), clause(350, 360, 'critical', 'other')])],
    );
    expect(g.summary.recall.num).toBe(2);
    expect(g.summary.levelAccuracy).toEqual({ num: 1, den: 2 });
    expect(g.summary.categoryAccuracy).toEqual({ num: 1, den: 2 });
  });

  it('prefers an acceptable level, otherwise the most severe', () => {
    // label b wants check: critical + check hit -> check is acceptable and chosen
    const g = grade(
      [contract],
      [call(1, [clause(310, 320, 'critical', 'other'), clause(330, 340, 'check', 'pets')])],
    );
    expect(g.summary.levelAccuracy.num).toBe(1);
    expect(g.summary.categoryAccuracy.num).toBe(1);
  });

  it('counts a fine-only hit as missed (seen as fine) and no hit as not hit', () => {
    const g = grade([contract], [call(1, [clause(150, 160, 'fine')])]);
    expect(g.summary.recall.num).toBe(0);
    expect(g.summary.missedSeenAsFine).toBe(1);
    expect(g.summary.missedNotHit).toBe(1);
  });

  it('separates false alarms from overcautious hits on clean labels', () => {
    const critical = grade([contract], [call(1, [clause(510, 520, 'critical')])]);
    expect(critical.summary.falseAlarmRate).toEqual({ num: 1, den: 1 });
    expect(critical.summary.overcautiousRate.num).toBe(0);
    const check = grade(
      [contract],
      [call(1, [clause(510, 520, 'check'), clause(530, 540, 'fine')])],
    );
    expect(check.summary.falseAlarmRate.num).toBe(0);
    expect(check.summary.overcautiousRate.num).toBe(1);
  });

  it('collects unmatched clauses', () => {
    const g = grade([contract], [call(1, [clause(700, 710, 'check')])]);
    expect(g.unmatched).toHaveLength(1);
    expect(g.unmatched[0]).toMatchObject({ contractId: 'rental-01', run: 1, level: 'check' });
  });

  it('excludes failed runs from recall and counts them', () => {
    const failed = call(2, [], {
      result: {
        ok: false,
        modelId: 'm',
        promptVersion: 'v1',
        usage: { inputTokens: 1, outputTokens: 1 },
        latencyMs: 50,
      },
      verification: undefined,
    });
    const errored: CallRecord = { contractId: 'rental-01', run: 3, error: 'boom' };
    const g = grade([contract], [call(1, [clause(150, 160, 'critical')]), failed, errored]);
    expect(g.summary.failedRuns).toEqual({ num: 2, den: 3 });
    expect(g.summary.recall).toMatchObject({ num: 1, den: 2 });
    expect(g.contracts[0]?.failedRuns).toBe(2);
  });

  it('aggregates over runs: mean, min, max and consistency', () => {
    const both = [clause(150, 160, 'critical'), clause(350, 360, 'check')];
    const g = grade([contract], [call(1, both), call(2, [clause(150, 160, 'critical')])]);
    expect(g.summary.recall).toMatchObject({ num: 3, den: 4, mean: 0.75, min: 0.5, max: 1 });
    expect(g.summary.consistency).toEqual({ num: 1, den: 2 });
    expect(g.contracts[0]?.missed).toEqual([
      { id: 'rental-01-b', runsMissed: 1, runs: 2, reasons: ['notHit'] },
    ]);
  });

  it('shares unverified and invalid clauses over all returned clauses', () => {
    const c = call(1, [clause(150, 160, 'check')], {
      verification: { clauses: [clause(150, 160, 'check')], unverifiedQuotes: 2 },
      result: {
        ok: true,
        modelId: 'm',
        promptVersion: 'v1',
        usage: { inputTokens: 1, outputTokens: 1 },
        latencyMs: 1,
        clauses: [],
        invalidClauses: 1,
      },
    });
    const g = grade([contract], [c]);
    expect(g.summary.unverifiedQuotes).toEqual({ num: 2, den: 4 });
    expect(g.summary.invalidClauses).toEqual({ num: 1, den: 4 });
  });
});

describe('percentile95', () => {
  it('uses nearest rank', () => {
    expect(percentile95([])).toBe(0);
    expect(percentile95([5])).toBe(5);
    expect(percentile95(Array.from({ length: 20 }, (_, i) => i + 1))).toBe(19);
    expect(percentile95([10, 1, 3])).toBe(10);
  });
});
