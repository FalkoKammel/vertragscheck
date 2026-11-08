import { describe, expect, it } from 'vitest';
import { Analysis, type AnalysisProps, type ModelRun } from '../domain/analysis';
import type { StoredClause } from '../domain/schemas';
import { toAnalysisResponse } from './AnalysisResponseMapper';

const RUN: ModelRun = {
  modelId: 'model-1',
  promptVersion: 'v1',
  usage: { inputTokens: 10, outputTokens: 5 },
  costMicroUsd: 42,
  latencyMs: 800,
};
const CLAUSE: StoredClause = {
  ref: '§ 4',
  category: 'deposit',
  level: 'critical',
  quote: 'vier Nettokaltmieten',
  reason: 'Zu hoch',
  start: 10,
  end: 30,
};

function analysis(props: Partial<AnalysisProps>) {
  return new Analysis({
    id: 'a1',
    status: 'done',
    contractType: 'rental',
    language: 'de',
    createdAt: new Date('2026-11-03T10:00:00Z'),
    startedAt: new Date('2026-11-03T10:01:00Z'),
    expiresAt: new Date('2026-12-03T10:00:00Z'),
    deleteTokenHash: 'secret-hash',
    ...props,
  });
}

const BASE = {
  id: 'a1',
  contractType: 'rental',
  language: 'de',
  createdAt: '2026-11-03T10:00:00.000Z',
  expiresAt: '2026-12-03T10:00:00.000Z',
};

describe('toAnalysisResponse', () => {
  it('maps a done analysis with result and flat run figures', () => {
    const a = analysis({ clauses: [CLAUSE], unverifiedQuotes: 1, invalidClauses: 2, run: RUN });
    expect(toAnalysisResponse({ analysis: a, status: 'done', text: 'Text' })).toEqual({
      ...BASE,
      status: 'done',
      result: {
        text: 'Text',
        clauses: [CLAUSE],
        unverifiedQuotes: 1,
        invalidClauses: 2,
        run: {
          modelId: 'model-1',
          promptVersion: 'v1',
          costMicroUsd: 42,
          latencyMs: 800,
          inputTokens: 10,
          outputTokens: 5,
        },
      },
    });
  });

  it('maps a failed analysis with its reason and no result', () => {
    const a = analysis({ status: 'failed', failureReason: 'TIMEOUT' });
    const response = toAnalysisResponse({
      analysis: a,
      status: 'failed',
      failureReason: 'TIMEOUT',
    });
    expect(response).toEqual({ ...BASE, status: 'failed', failureReason: 'TIMEOUT' });
  });

  it('maps a running analysis without result and failureReason', () => {
    const a = analysis({ status: 'running' });
    expect(toAnalysisResponse({ analysis: a, status: 'running' })).toEqual({
      ...BASE,
      status: 'running',
    });
  });

  it('includes the stage only while running', () => {
    const a = analysis({ status: 'running', stage: 'analysing' });
    expect(toAnalysisResponse({ analysis: a, status: 'running' })).toEqual({
      ...BASE,
      status: 'running',
      stage: 'analysing',
    });
    // e.g. a running item reported as failed because of the timeout
    expect(
      toAnalysisResponse({ analysis: a, status: 'failed', failureReason: 'TIMEOUT' }),
    ).not.toHaveProperty('stage');
  });

  it('omits the stage for a running analysis that has none yet', () => {
    const a = analysis({ status: 'running' });
    expect(toAnalysisResponse({ analysis: a, status: 'running' })).not.toHaveProperty('stage');
  });

  it('maps a pending upload', () => {
    const a = analysis({ status: 'pending_upload', startedAt: undefined });
    expect(toAnalysisResponse({ analysis: a, status: 'pending_upload' })).toEqual({
      ...BASE,
      status: 'pending_upload',
    });
  });

  it('omits the failure reason when the status is not failed', () => {
    const a = analysis({ status: 'failed', failureReason: 'INTERNAL' });
    const response = toAnalysisResponse({
      analysis: a,
      status: 'running',
      failureReason: 'INTERNAL',
    });
    expect(response).not.toHaveProperty('failureReason');
  });

  it('never contains the delete token hash or startedAt', () => {
    const done = analysis({ run: RUN, clauses: [CLAUSE] });
    for (const response of [
      toAnalysisResponse({ analysis: done, status: 'done', text: 'Text' }),
      toAnalysisResponse({ analysis: done, status: 'running' }),
      toAnalysisResponse({ analysis: done, status: 'failed', failureReason: 'TIMEOUT' }),
    ]) {
      const json = JSON.stringify(response);
      expect(json).not.toContain('secret-hash');
      expect(json).not.toContain('deleteTokenHash');
      expect(json).not.toContain('startedAt');
    }
  });
});
