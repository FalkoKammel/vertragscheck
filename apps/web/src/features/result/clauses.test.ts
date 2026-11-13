import { describe, expect, it } from 'vitest';
import type { Clause } from '@/lib/api/analyses';
import {
  countByLevel,
  employmentCategory,
  fineOrder,
  initialSelection,
  modelLabelKey,
  mostSevere,
  notableOrder,
  rentalCategory,
} from './clauses';

const c = (start: number, level: Clause['level']): Clause => ({
  category: 'rent',
  level,
  quote: 'q',
  reason: 'r',
  start,
  end: start + 5,
});

const CLAUSES = [
  c(50, 'check'),
  c(10, 'fine'),
  c(30, 'critical'),
  c(5, 'check'),
  c(80, 'critical'),
];

describe('clause helpers', () => {
  it('orders notable clauses by severity, then position', () => {
    expect(notableOrder(CLAUSES)).toEqual([2, 4, 3, 0]);
  });

  it('lists fine clauses by position', () => {
    expect(fineOrder([...CLAUSES, c(1, 'fine')])).toEqual([5, 1]);
  });

  it('selects the first critical clause initially, else the first check', () => {
    expect(initialSelection(CLAUSES)).toBe(2);
    expect(initialSelection([c(9, 'check'), c(3, 'check'), c(1, 'fine')])).toBe(1);
    expect(initialSelection([c(1, 'fine')])).toBeNull();
    expect(initialSelection([])).toBeNull();
  });

  it('finds the most severe clause among indexes', () => {
    expect(mostSevere([0, 2, 3], CLAUSES)).toBe(2);
    expect(mostSevere([0, 3], CLAUSES)).toBe(3);
    expect(mostSevere([], CLAUSES)).toBeNull();
  });

  it('counts clauses per level', () => {
    expect(countByLevel(CLAUSES)).toEqual({ fine: 1, check: 2, critical: 2 });
  });

  it('maps known model IDs to a message key', () => {
    expect(modelLabelKey('eu.anthropic.claude-haiku-4-5-20251001-v1:0')).toBe('haiku45Eu');
    expect(modelLabelKey('anthropic.claude-haiku-4-5-20251001-v1:0')).toBe('haiku45');
    expect(modelLabelKey('something-else')).toBeNull();
  });

  it('falls back to other for unknown categories', () => {
    expect(rentalCategory('deposit')).toBe('deposit');
    expect(rentalCategory('probation')).toBe('other');
    expect(employmentCategory('probation')).toBe('probation');
  });
});
