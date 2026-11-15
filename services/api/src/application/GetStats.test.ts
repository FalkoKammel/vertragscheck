import { describe, expect, it } from 'vitest';
import type { MonthAnalysisSummary } from '../domain/monthStats';
import { GetStats } from './GetStats';

const item: MonthAnalysisSummary = {
  status: 'done',
  costMicroUsd: 12_000,
  latencyMs: 3000,
  clauseCount: 4,
  unverifiedQuotes: 0,
  invalidClauses: 0,
};

describe('GetStats', () => {
  it('queries the month of the clock and combines stats, budget and active model', async () => {
    const months: string[] = [];
    const useCase = new GetStats({
      clock: { now: () => new Date('2026-11-15T10:00:00Z') },
      activeModelId: 'model-x',
      analyses: {
        listMonth: (month) => {
          months.push(month);
          return Promise.resolve([item]);
        },
      },
      budget: {
        getMonthBudget: (month) => {
          months.push(month);
          return Promise.resolve({ spentMicroUsd: 2_400_000, limitMicroUsd: 10_000_000 });
        },
      },
    });

    const out = await useCase.execute();

    expect(months).toEqual(['2026-11', '2026-11']);
    expect(out.month).toBe('2026-11');
    expect(out.stats.done).toBe(1);
    expect(out.stats.meanCostMicroUsd).toBe(12_000);
    expect(out.budget).toEqual({ spentMicroUsd: 2_400_000, limitMicroUsd: 10_000_000 });
    expect(out.activeModelId).toBe('model-x');
  });
});
