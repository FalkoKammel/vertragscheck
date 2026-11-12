import { describe, expect, it } from 'vitest';
import { Analysis, type AnalysisProps, type ModelRun } from './analysis';
import { InvalidStatusTransitionError } from './DomainError';
import { RUNNING_TIMEOUT_MS, UPLOAD_TIMEOUT_MS } from './policy';

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
    a.complete({
      verification: { clauses: [], unverifiedQuotes: 2 },
      invalidClauses: 3,
      pages: { starts: [0], count: 1 },
      run: RUN,
    });
    expect(a.status).toBe('done');
    expect(a.unverifiedQuotes).toBe(2);
    expect(a.invalidClauses).toBe(3);
    expect(a.run).toEqual(RUN);
  });

  it('has no page data by default, complete stores it and toProps returns it', () => {
    const a = running();
    expect(a.pageStarts).toBeUndefined();
    expect(a.pageCount).toBeUndefined();
    a.complete({
      verification: { clauses: [], unverifiedQuotes: 0 },
      invalidClauses: 0,
      pages: { starts: [0, 20, 20], count: 3 },
      run: RUN,
    });
    expect(a.pageStarts).toEqual([0, 20, 20]);
    expect(a.pageCount).toBe(3);
    expect(a.toProps()).toMatchObject({ pageStarts: [0, 20, 20], pageCount: 3 });
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
        pages: { starts: [0], count: 1 },
        run: RUN,
      });
    }).toThrow(InvalidStatusTransitionError);
    expect(() => {
      a.fail('INTERNAL');
    }).toThrow(InvalidStatusTransitionError);
  });

  it('round-trips through toProps', () => {
    const a = running();
    a.complete({
      verification: { clauses: [], unverifiedQuotes: 1 },
      invalidClauses: 2,
      pages: { starts: [0], count: 1 },
      run: RUN,
    });
    expect(new Analysis(a.toProps())).toEqual(a);
  });

  it('start records when the analysis started', () => {
    const a = new Analysis({ ...running().toProps(), status: 'pending_upload' });
    const now = new Date('2026-11-03T10:01:00Z');
    a.start(now);
    expect(a.status).toBe('running');
    expect(a.startedAt).toEqual(now);
  });

  it('start sets the stage extracting and setStage changes it', () => {
    const a = new Analysis({ ...running().toProps(), status: 'pending_upload' });
    a.start(new Date());
    expect(a.stage).toBe('extracting');
    a.setStage('analysing');
    expect(a.stage).toBe('analysing');
  });

  it('complete and fail clear the stage', () => {
    const done = new Analysis({ ...running().toProps(), stage: 'analysing' });
    done.complete({
      verification: { clauses: [], unverifiedQuotes: 0 },
      invalidClauses: 0,
      pages: { starts: [0], count: 1 },
      run: RUN,
    });
    expect(done.stage).toBeUndefined();
    const failed = new Analysis({ ...running().toProps(), stage: 'analysing' });
    failed.fail('INTERNAL');
    expect(failed.stage).toBeUndefined();
  });

  it('setStage is only allowed while running', () => {
    const a = new Analysis({ ...running().toProps(), status: 'pending_upload' });
    expect(() => {
      a.setStage('analysing');
    }).toThrow(InvalidStatusTransitionError);
  });

  it('start is only allowed from pending_upload', () => {
    expect(() => {
      running().start(new Date());
    }).toThrow(InvalidStatusTransitionError);
  });
});

describe('Analysis.effectiveStatus', () => {
  const createdAt = new Date('2026-11-03T10:00:00Z');
  const startedAt = new Date('2026-11-03T10:02:00Z');
  const after = (from: Date, ms: number) => new Date(from.getTime() + ms);
  const make = (props: Partial<AnalysisProps>) =>
    new Analysis({ ...running().toProps(), createdAt, ...props });

  it('keeps a running analysis running up to exactly the timeout', () => {
    const a = make({ status: 'running', startedAt });
    expect(a.effectiveStatus(after(startedAt, RUNNING_TIMEOUT_MS))).toEqual({ status: 'running' });
  });

  it('reports a running analysis as TIMEOUT one millisecond after the timeout', () => {
    const a = make({ status: 'running', startedAt });
    expect(a.effectiveStatus(after(startedAt, RUNNING_TIMEOUT_MS + 1))).toEqual({
      status: 'failed',
      failureReason: 'TIMEOUT',
    });
  });

  it('never times out a running analysis without startedAt', () => {
    const a = make({ status: 'running' });
    expect(a.effectiveStatus(after(createdAt, 24 * 60 * 60 * 1000))).toEqual({
      status: 'running',
    });
  });

  it('keeps a pending_upload analysis pending up to exactly the timeout', () => {
    const a = make({ status: 'pending_upload' });
    expect(a.effectiveStatus(after(createdAt, UPLOAD_TIMEOUT_MS))).toEqual({
      status: 'pending_upload',
    });
  });

  it('reports a pending_upload analysis as UPLOAD_MISSING one millisecond after the timeout', () => {
    const a = make({ status: 'pending_upload' });
    expect(a.effectiveStatus(after(createdAt, UPLOAD_TIMEOUT_MS + 1))).toEqual({
      status: 'failed',
      failureReason: 'UPLOAD_MISSING',
    });
  });

  it('returns a stored failure with its reason, however old', () => {
    const a = make({ status: 'failed', failureReason: 'NO_TEXT_LAYER', startedAt });
    expect(a.effectiveStatus(after(startedAt, 10 * RUNNING_TIMEOUT_MS))).toEqual({
      status: 'failed',
      failureReason: 'NO_TEXT_LAYER',
    });
  });

  it('returns a stored done as done, however old', () => {
    const a = make({ status: 'done', run: RUN, startedAt });
    expect(a.effectiveStatus(after(startedAt, 10 * RUNNING_TIMEOUT_MS))).toEqual({
      status: 'done',
    });
  });

  it('does not change the stored status', () => {
    const a = make({ status: 'running', startedAt });
    a.effectiveStatus(after(startedAt, RUNNING_TIMEOUT_MS + 1));
    expect(a.status).toBe('running');
    expect(a.failureReason).toBeUndefined();
  });
});
