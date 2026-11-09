import type { SeverityLevel, StoredClause } from 'api/src/domain/schemas';
import type { Contract, Level, Span } from './load';
import type { CallRecord } from './results.schema';

export type MissReason = 'seenAsFine' | 'notHit';

export interface Ratio {
  num: number;
  den: number;
}

export interface RateOverRuns extends Ratio {
  mean: number;
  min: number;
  max: number;
}

export interface UnmatchedClause {
  contractId: string;
  run: number;
  quote: string;
  category: string;
  level: string;
  reason: string;
}

export interface LabelOutcome {
  contractId: string;
  run: number;
  id: string;
  level: Level;
  found: boolean;
  levelCorrect: boolean;
  categoryCorrect: boolean;
  missReason?: MissReason;
}

export interface CleanOutcome {
  contractId: string;
  run: number;
  anchor: string;
  falseAlarm: boolean;
  overcautious: boolean;
}

export interface ContractSummary {
  contractId: string;
  successfulRuns: number;
  failedRuns: number;
  recall: Ratio;
  missed: { id: string; runsMissed: number; runs: number; reasons: MissReason[] }[];
  falseAlarms: { anchor: string; runs: number }[];
  falseAlarmRate: Ratio;
  overcautiousRate: Ratio;
}

export interface Summary {
  recall: RateOverRuns;
  recallCritical: RateOverRuns;
  recallCheck: RateOverRuns;
  missedSeenAsFine: number;
  missedNotHit: number;
  consistency: Ratio;
  levelAccuracy: Ratio;
  categoryAccuracy: Ratio;
  falseAlarmRate: Ratio;
  overcautiousRate: Ratio;
  unverifiedQuotes: Ratio;
  invalidClauses: Ratio;
  failedRuns: Ratio;
  costMicroUsd: { mean: number; total: number };
  latencyMs: { mean: number; p95: number };
}

export interface GradeResult {
  summary: Summary;
  contracts: ContractSummary[];
  unmatched: UnmatchedClause[];
  labelCount: number;
}

const SEVERITY: Record<SeverityLevel, number> = { fine: 0, check: 1, critical: 2 };

export function overlaps(a: Span, b: Span): boolean {
  return a.start < b.end && b.start < a.end;
}

function mostSevere(clauses: StoredClause[]): StoredClause | undefined {
  return clauses.reduce<StoredClause | undefined>(
    (best, c) => (best === undefined || SEVERITY[c.level] > SEVERITY[best.level] ? c : best),
    undefined,
  );
}

export function percentile95(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(0.95 * sorted.length) - 1)] ?? 0;
}

function mean(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((s, v) => s + v, 0) / values.length;
}

function isSuccessful(call: CallRecord): call is CallRecord & {
  verification: NonNullable<CallRecord['verification']>;
  result: { ok: true } & NonNullable<CallRecord['result']>;
} {
  return call.error === undefined && call.result?.ok === true && call.verification !== undefined;
}

function rateOverRuns(perRun: Ratio[]): RateOverRuns {
  const valid = perRun.filter((r) => r.den > 0).map((r) => r.num / r.den);
  return {
    num: perRun.reduce((s, r) => s + r.num, 0),
    den: perRun.reduce((s, r) => s + r.den, 0),
    mean: mean(valid),
    min: valid.length === 0 ? 0 : Math.min(...valid),
    max: valid.length === 0 ? 0 : Math.max(...valid),
  };
}

export function gradeCall(
  contract: Contract,
  call: CallRecord & { verification: NonNullable<CallRecord['verification']> },
): { labels: LabelOutcome[]; clean: CleanOutcome[]; unmatched: UnmatchedClause[] } {
  const clauses = call.verification.clauses;
  const base = { contractId: contract.id, run: call.run };

  const labels = contract.expected.map((label): LabelOutcome => {
    const hits = clauses.filter((c) => overlaps(c, label));
    const strong = hits.filter((c) => c.level !== 'fine');
    const out = { ...base, id: label.id, level: label.level };
    if (strong.length === 0) {
      return {
        ...out,
        found: false,
        levelCorrect: false,
        categoryCorrect: false,
        missReason: hits.length > 0 ? 'seenAsFine' : 'notHit',
      };
    }
    const acceptable = strong.filter(
      (c) => c.level === label.level || label.acceptLevels.includes(c.level as Level),
    );
    const picked = mostSevere(acceptable.length > 0 ? acceptable : strong);
    if (picked === undefined) throw new Error('unreachable: strong is not empty');
    return {
      ...out,
      found: true,
      levelCorrect: acceptable.length > 0,
      categoryCorrect: picked.category === label.category,
    };
  });

  const clean = contract.clean.map((label): CleanOutcome => {
    const top = mostSevere(clauses.filter((c) => overlaps(c, label)));
    return {
      ...base,
      anchor: label.anchor,
      falseAlarm: top?.level === 'critical',
      overcautious: top?.level === 'check',
    };
  });

  const all: Span[] = [...contract.expected, ...contract.clean];
  const unmatched = clauses
    .filter((c) => !all.some((l) => overlaps(c, l)))
    .map((c) => ({
      ...base,
      quote: c.quote,
      category: c.category,
      level: c.level,
      reason: c.reason,
    }));
  return { labels, clean, unmatched };
}

export function grade(contracts: Contract[], calls: CallRecord[]): GradeResult {
  const byContract = new Map(contracts.map((c) => [c.id, c]));
  const labelOutcomes: LabelOutcome[] = [];
  const cleanOutcomes: CleanOutcome[] = [];
  const unmatched: UnmatchedClause[] = [];
  const okCalls: CallRecord[] = [];
  let unverified = 0;
  let invalid = 0;
  let returned = 0;

  const relevant = calls.filter((c) => byContract.has(c.contractId));
  for (const call of relevant) {
    if (!isSuccessful(call)) continue;
    const contract = byContract.get(call.contractId);
    if (contract === undefined) continue;
    okCalls.push(call);
    const g = gradeCall(contract, call);
    labelOutcomes.push(...g.labels);
    cleanOutcomes.push(...g.clean);
    unmatched.push(...g.unmatched);
    unverified += call.verification.unverifiedQuotes;
    invalid += call.result.invalidClauses;
    returned +=
      call.verification.clauses.length +
      call.verification.unverifiedQuotes +
      call.result.invalidClauses;
  }

  const runIndices = [...new Set(okCalls.map((c) => c.run))].sort((a, b) => a - b);
  const perRun = (filter: (o: LabelOutcome) => boolean): Ratio[] =>
    runIndices.map((r) => {
      const os = labelOutcomes.filter((o) => o.run === r && filter(o));
      return { num: os.filter((o) => o.found).length, den: os.length };
    });

  const found = labelOutcomes.filter((o) => o.found);
  const missed = labelOutcomes.filter((o) => !o.found);

  const consistency: Ratio = { num: 0, den: 0 };
  const contractSummaries: ContractSummary[] = [];
  for (const contract of contracts) {
    const cCalls = relevant.filter((c) => c.contractId === contract.id);
    const okRuns = cCalls.filter(isSuccessful).map((c) => c.run);
    const lo = labelOutcomes.filter((o) => o.contractId === contract.id);
    const co = cleanOutcomes.filter((o) => o.contractId === contract.id);
    const missedList: ContractSummary['missed'] = [];
    for (const label of contract.expected) {
      const outcomes = lo.filter((o) => o.id === label.id);
      if (outcomes.length === 0) continue;
      consistency.den++;
      if (outcomes.every((o) => o.found)) consistency.num++;
      const misses = outcomes.filter((o) => !o.found);
      if (misses.length > 0) {
        missedList.push({
          id: label.id,
          runsMissed: misses.length,
          runs: outcomes.length,
          reasons: [...new Set(misses.map((m) => m.missReason ?? 'notHit'))],
        });
      }
    }
    contractSummaries.push({
      contractId: contract.id,
      successfulRuns: okRuns.length,
      failedRuns: cCalls.length - okRuns.length,
      recall: { num: lo.filter((o) => o.found).length, den: lo.length },
      missed: missedList,
      falseAlarms: contract.clean
        .map((l) => ({
          anchor: l.anchor,
          runs: co.filter((o) => o.anchor === l.anchor && o.falseAlarm).length,
        }))
        .filter((f) => f.runs > 0),
      falseAlarmRate: { num: co.filter((o) => o.falseAlarm).length, den: co.length },
      overcautiousRate: { num: co.filter((o) => o.overcautious).length, den: co.length },
    });
  }

  const costs = relevant.flatMap((c) => (c.costMicroUsd === undefined ? [] : [c.costMicroUsd]));
  const latencies = relevant.flatMap((c) => (c.result ? [c.result.latencyMs] : []));

  const summary: Summary = {
    recall: rateOverRuns(perRun(() => true)),
    recallCritical: rateOverRuns(perRun((o) => o.level === 'critical')),
    recallCheck: rateOverRuns(perRun((o) => o.level === 'check')),
    missedSeenAsFine: missed.filter((o) => o.missReason === 'seenAsFine').length,
    missedNotHit: missed.filter((o) => o.missReason === 'notHit').length,
    consistency,
    levelAccuracy: { num: found.filter((o) => o.levelCorrect).length, den: found.length },
    categoryAccuracy: { num: found.filter((o) => o.categoryCorrect).length, den: found.length },
    falseAlarmRate: {
      num: cleanOutcomes.filter((o) => o.falseAlarm).length,
      den: cleanOutcomes.length,
    },
    overcautiousRate: {
      num: cleanOutcomes.filter((o) => o.overcautious).length,
      den: cleanOutcomes.length,
    },
    unverifiedQuotes: { num: unverified, den: returned },
    invalidClauses: { num: invalid, den: returned },
    failedRuns: { num: relevant.length - okCalls.length, den: relevant.length },
    costMicroUsd: { mean: mean(costs), total: costs.reduce((s, v) => s + v, 0) },
    latencyMs: { mean: mean(latencies), p95: percentile95(latencies) },
  };

  return {
    summary,
    contracts: contractSummaries,
    unmatched,
    labelCount: contracts.reduce((n, c) => n + c.expected.length + c.clean.length, 0),
  };
}
