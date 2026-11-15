import type { AnalysisStatus } from './analysis';

export interface MonthAnalysisSummary {
  status: AnalysisStatus;
  costMicroUsd?: number;
  latencyMs?: number;
  clauseCount: number;
  unverifiedQuotes: number;
  invalidClauses: number;
}

export interface MonthStats {
  done: number;
  failed: number;
  meanCostMicroUsd: number | null;
  p95LatencyMs: number | null;
  unverifiedQuotes: { num: number; den: number };
}

export function percentile95(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(0.95 * sorted.length) - 1)] ?? null;
}

export function aggregateMonthStats(items: readonly MonthAnalysisSummary[]): MonthStats {
  const done = items.filter((i) => i.status === 'done');
  const failed = items.filter((i) => i.status === 'failed').length;

  const costs = done.flatMap((i) => (i.costMicroUsd === undefined ? [] : [i.costMicroUsd]));
  const latencies = done.flatMap((i) => (i.latencyMs === undefined ? [] : [i.latencyMs]));

  let num = 0;
  let den = 0;
  for (const i of done) {
    num += i.unverifiedQuotes;
    den += i.clauseCount + i.unverifiedQuotes + i.invalidClauses;
  }

  return {
    done: done.length,
    failed,
    meanCostMicroUsd: costs.length === 0 ? null : costs.reduce((s, c) => s + c, 0) / costs.length,
    p95LatencyMs: percentile95(latencies),
    unverifiedQuotes: { num, den },
  };
}
