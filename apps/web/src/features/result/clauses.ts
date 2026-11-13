import type { Clause } from '@/lib/api/analyses';
import { SEVERITY, type Level } from '@/lib/segmentText';

const bySeverityThenStart = (clauses: Clause[]) => (a: number, b: number) => {
  const first = clauses[a];
  const second = clauses[b];
  if (!first || !second) return 0;
  return SEVERITY[second.level] - SEVERITY[first.level] || first.start - second.start;
};

/** Indexes of the check and critical clauses: most severe first, then by position. */
export function notableOrder(clauses: Clause[]): number[] {
  return clauses
    .map((clause, index) => ({ clause, index }))
    .filter(({ clause }) => clause.level !== 'fine')
    .map(({ index }) => index)
    .sort(bySeverityThenStart(clauses));
}

/** Indexes of the fine clauses by position. */
export function fineOrder(clauses: Clause[]): number[] {
  return clauses
    .map((clause, index) => ({ clause, index }))
    .filter(({ clause }) => clause.level === 'fine')
    .map(({ index }) => index)
    .sort(bySeverityThenStart(clauses));
}

/** The first critical clause, else the first check clause, else nothing. */
export function initialSelection(clauses: Clause[]): number | null {
  return notableOrder(clauses)[0] ?? null;
}

/** The most severe clause among the given indexes; the earlier one wins a tie. */
export function mostSevere(indexes: number[], clauses: Clause[]): number | null {
  const sorted = indexes.filter((index) => clauses[index] !== undefined);
  sorted.sort(bySeverityThenStart(clauses));
  return sorted[0] ?? null;
}

export function countByLevel(clauses: Clause[]): Record<Level, number> {
  const counts: Record<Level, number> = { fine: 0, check: 0, critical: 0 };
  for (const clause of clauses) counts[clause.level] += 1;
  return counts;
}

export type ModelLabelKey = 'haiku45Eu' | 'haiku45';

/** Message key for a known model ID, null for anything else (then the raw ID is shown). */
export function modelLabelKey(modelId: string): ModelLabelKey | null {
  if (!modelId.includes('claude-haiku-4-5')) return null;
  return modelId.startsWith('eu.') ? 'haiku45Eu' : 'haiku45';
}

export const CATEGORY_IDS = {
  rental: [
    'rent',
    'operating_costs',
    'deposit',
    'cosmetic_repairs',
    'minor_repairs',
    'term_termination',
    'use_subletting',
    'pets',
    'alterations',
    'other',
  ],
  employment: [
    'probation',
    'working_time',
    'compensation',
    'vacation',
    'termination',
    'non_compete',
    'exclusion_periods',
    'repayment',
    'penalty',
    'side_jobs',
    'place_of_work',
    'other',
  ],
} as const;

export type ContractType = keyof typeof CATEGORY_IDS;
export type RentalCategory = (typeof CATEGORY_IDS.rental)[number];
export type EmploymentCategory = (typeof CATEGORY_IDS.employment)[number];

/** Falls back to "other" for a category the frontend does not know. */
export function rentalCategory(category: string): RentalCategory {
  return CATEGORY_IDS.rental.find((id) => id === category) ?? 'other';
}

export function employmentCategory(category: string): EmploymentCategory {
  return CATEGORY_IDS.employment.find((id) => id === category) ?? 'other';
}
