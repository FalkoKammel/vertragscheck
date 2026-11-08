import { describe, expect, it } from 'vitest';
import { analysisResponseSchema } from '../lib/api/analyses';
import { analysisFixture, FIXTURE_STATES } from './analysisFixtures';

describe('analysis fixtures', () => {
  it.each(FIXTURE_STATES)('the %s fixture matches the response schema', (state) => {
    const fixture = analysisFixture(state, 'a1');
    expect(analysisResponseSchema.parse(fixture)).toEqual(fixture);
    expect(fixture.id).toBe('a1');
    expect(fixture.status).toBe(state);
  });

  it('only the done fixture has a result and only the failed one a reason', () => {
    expect(analysisFixture('done', 'a1').result).toBeDefined();
    expect(analysisFixture('failed', 'a1').failureReason).toBeDefined();
    for (const state of ['pending_upload', 'running', 'failed'] as const) {
      expect(analysisFixture(state, 'a1').result).toBeUndefined();
    }
    for (const state of ['pending_upload', 'running', 'done'] as const) {
      expect(analysisFixture(state, 'a1').failureReason).toBeUndefined();
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
});
