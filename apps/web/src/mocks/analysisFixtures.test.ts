import { describe, expect, it } from 'vitest';
import { analysisResponseSchema } from '../lib/api/analyses';
import { analysisFixture, FIXTURE_PAGE_STARTS, FIXTURE_STATES } from './analysisFixtures';

describe('analysis fixtures', () => {
  it.each(FIXTURE_STATES)('the %s fixture matches the response schema', (state) => {
    const fixture = analysisFixture(state, 'a1');
    expect(analysisResponseSchema.parse(fixture)).toEqual(fixture);
    expect(fixture.id).toBe('a1');
    expect(fixture.status).toBe(state === 'analysing' ? 'running' : state);
  });

  it('only the done fixture has a result and only the failed one a reason', () => {
    expect(analysisFixture('done', 'a1').result).toBeDefined();
    expect(analysisFixture('failed', 'a1').failureReason).toBeDefined();
    for (const state of ['pending_upload', 'running', 'analysing', 'failed'] as const) {
      expect(analysisFixture(state, 'a1').result).toBeUndefined();
    }
    for (const state of ['pending_upload', 'running', 'analysing', 'done'] as const) {
      expect(analysisFixture(state, 'a1').failureReason).toBeUndefined();
    }
  });

  it('only running fixtures have a stage', () => {
    expect(analysisFixture('running', 'a1').stage).toBe('extracting');
    expect(analysisFixture('analysing', 'a1').stage).toBe('analysing');
    for (const state of ['pending_upload', 'done', 'failed'] as const) {
      expect(analysisFixture(state, 'a1').stage).toBeUndefined();
    }
  });

  it('every clause offset points at its quote in the text', () => {
    const result = analysisFixture('done', 'a1').result;
    expect(result?.clauses.length).toBeGreaterThanOrEqual(3);
    for (const c of result?.clauses ?? []) {
      expect(result?.text.slice(c.start, c.end)).toBe(c.quote);
    }
  });

  it('clauses do not overlap and cover all three levels', () => {
    const clauses = [...(analysisFixture('done', 'a1').result?.clauses ?? [])].sort(
      (a, b) => a.start - b.start,
    );
    clauses.slice(1).forEach((c, i) => {
      expect(c.start).toBeGreaterThanOrEqual(clauses[i]?.end ?? 0);
    });
    expect(new Set(clauses.map((c) => c.level))).toEqual(new Set(['fine', 'check', 'critical']));
  });

  it('the done fixture has three pages whose starts point at their first paragraph', () => {
    const fixture = analysisFixture('done', 'a1');
    const starts = fixture.result?.pageStarts ?? [];
    const [, second = 0, third = 0] = starts;
    expect(fixture.pageCount).toBe(3);
    expect(starts).toEqual(FIXTURE_PAGE_STARTS);
    expect(starts).toHaveLength(3);
    expect(starts[0]).toBe(0);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
    const text = fixture.result?.text ?? '';
    expect(text.slice(second).startsWith('§ 3 Miete.')).toBe(true);
    expect(text.slice(third).startsWith('§ 6 Tierhaltung.')).toBe(true);
    expect(text.slice(second - 2, second)).toBe('\n\n');
  });

  it('only the done fixture has page data', () => {
    for (const state of ['pending_upload', 'running', 'analysing', 'failed'] as const) {
      expect(analysisFixture(state, 'a1').pageCount).toBeUndefined();
    }
  });
});
