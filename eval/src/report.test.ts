import { describe, expect, it } from 'vitest';
import type { Summary } from './grade';
import { pct, reportGate } from './report';
import { modelShortName, resultsBaseName } from './run';

describe('pct', () => {
  it('rounds to whole numbers and shows counts', () => {
    expect(pct({ num: 41, den: 48 })).toBe('85 % (41/48)');
    expect(pct({ num: 0, den: 0 })).toBe('–');
  });
});

describe('result file naming', () => {
  it('shortens the model id', () => {
    expect(modelShortName('eu.anthropic.claude-haiku-4-5-20251001-v1:0')).toBe('claude-haiku-4-5');
  });
  it('builds the base name', () => {
    expect(
      resultsBaseName(
        new Date('2026-11-09T14:05:00Z'),
        'v1',
        'eu.anthropic.claude-haiku-4-5-20251001-v1:0',
      ),
    ).toBe('2026-11-09T1405-v1-claude-haiku-4-5');
  });
});

describe('reportGate', () => {
  const withFailed = (num: number, den: number) => ({ failedRuns: { num, den } }) as Summary;

  it('is complete without warning when nothing failed', () => {
    expect(reportGate(withFailed(0, 24))).toEqual({ complete: true });
  });
  it('warns but still reports when few calls failed', () => {
    const g = reportGate(withFailed(2, 24));
    expect(g.complete).toBe(true);
    expect(g.warning).toContain('2 of 24');
  });
  it('blocks the report when more than 10 % failed', () => {
    expect(reportGate(withFailed(5, 24)).complete).toBe(false);
    expect(reportGate(withFailed(0, 0))).toEqual({ complete: true });
  });
});
