import { describe, expect, it } from 'vitest';
import { Analysis, type AnalysisProps, type ModelRun } from '../domain/analysis';
import { AnalysisNotFoundError } from '../domain/DomainError';
import { RUNNING_TIMEOUT_MS, UPLOAD_TIMEOUT_MS } from '../domain/policy';
import { GetAnalysis } from './GetAnalysis';

const CREATED = new Date('2026-11-03T10:00:00Z');
const STARTED = new Date('2026-11-03T10:01:00Z');
const RUN: ModelRun = {
  modelId: 'model-1',
  promptVersion: 'v1',
  usage: { inputTokens: 10, outputTokens: 5 },
  costMicroUsd: 42,
  latencyMs: 800,
};

function setup(
  props: Partial<AnalysisProps> & { now?: Date; text?: string | null; missing?: boolean },
) {
  const { now, text, missing, ...analysisProps } = props;
  const analysis = new Analysis({
    id: 'a1',
    status: 'done',
    contractType: 'rental',
    language: 'de',
    createdAt: CREATED,
    startedAt: STARTED,
    expiresAt: new Date('2026-12-03T10:00:00Z'),
    deleteTokenHash: 'hash',
    run: RUN,
    ...analysisProps,
  });
  const textReads: string[] = [];
  const useCase = new GetAnalysis({
    analysisStore: { get: () => Promise.resolve(missing ? undefined : analysis) },
    textStore: {
      getText: (id) => {
        textReads.push(id);
        return Promise.resolve(text === null ? undefined : (text ?? 'Vertragstext'));
      },
    },
    clock: { now: () => now ?? new Date('2026-11-03T10:05:00Z') },
  });
  return { execute: () => useCase.execute({ analysisId: 'a1' }), analysis, textReads };
}

describe('GetAnalysis', () => {
  it('returns a done analysis with its text', async () => {
    const { execute, analysis } = setup({});
    expect(await execute()).toEqual({ analysis, status: 'done', text: 'Vertragstext' });
  });

  it('returns a running analysis without reading the text', async () => {
    const { execute, textReads } = setup({ status: 'running', run: undefined });
    const out = await execute();
    expect(out.status).toBe('running');
    expect(out.text).toBeUndefined();
    expect(textReads).toEqual([]);
  });

  it('returns a stored failure with its reason', async () => {
    const out = await setup({ status: 'failed', failureReason: 'NO_TEXT_LAYER' }).execute();
    expect(out).toMatchObject({ status: 'failed', failureReason: 'NO_TEXT_LAYER' });
    expect(out.text).toBeUndefined();
  });

  it('throws AnalysisNotFoundError for an unknown analysis', async () => {
    await expect(setup({ missing: true }).execute()).rejects.toThrow(AnalysisNotFoundError);
  });

  it('throws the same error for an expired analysis', async () => {
    const { execute } = setup({ expiresAt: new Date('2026-11-03T10:05:00Z') });
    await expect(execute()).rejects.toThrow(AnalysisNotFoundError);
  });

  it('turns a done analysis with a missing text into an INTERNAL failure', async () => {
    const out = await setup({ text: null }).execute();
    expect(out).toMatchObject({ status: 'failed', failureReason: 'INTERNAL' });
    expect(out.text).toBeUndefined();
  });

  it('turns a done analysis without a run into an INTERNAL failure', async () => {
    const out = await setup({ run: undefined }).execute();
    expect(out).toMatchObject({ status: 'failed', failureReason: 'INTERNAL' });
  });

  it('reports a running analysis past the timeout as TIMEOUT', async () => {
    const { execute, textReads } = setup({
      status: 'running',
      run: undefined,
      now: new Date(STARTED.getTime() + RUNNING_TIMEOUT_MS + 1),
    });
    expect(await execute()).toMatchObject({ status: 'failed', failureReason: 'TIMEOUT' });
    expect(textReads).toEqual([]);
  });

  it('keeps a running analysis running at exactly the timeout', async () => {
    const { execute } = setup({
      status: 'running',
      run: undefined,
      now: new Date(STARTED.getTime() + RUNNING_TIMEOUT_MS),
    });
    expect(await execute()).toMatchObject({ status: 'running' });
  });

  it('reports a pending upload past the timeout as UPLOAD_MISSING', async () => {
    const { execute } = setup({
      status: 'pending_upload',
      startedAt: undefined,
      run: undefined,
      now: new Date(CREATED.getTime() + UPLOAD_TIMEOUT_MS + 1),
    });
    expect(await execute()).toMatchObject({ status: 'failed', failureReason: 'UPLOAD_MISSING' });
  });

  it('keeps a pending upload pending at exactly the timeout', async () => {
    const { execute } = setup({
      status: 'pending_upload',
      startedAt: undefined,
      run: undefined,
      now: new Date(CREATED.getTime() + UPLOAD_TIMEOUT_MS),
    });
    expect(await execute()).toMatchObject({ status: 'pending_upload' });
  });
});
