import { describe, expect, it, vi } from 'vitest';
import { Analysis } from '../domain/analysis';
import type { ModelRun, Usage } from '../domain/analysis';
import { InvalidPdfError } from '../domain/DomainError';
import { MAX_PDF_PAGES } from '../domain/policy';
import type { LlmClause } from '../domain/schemas';
import { AnalyseContract, toFailureReason, type AnalyseContractAdapters } from './AnalyseContract';
import type { AnalysisResult } from './adapters/RunsAnalysis';
import {
  BudgetExhaustedError,
  LlmInvalidOutputError,
  NoTextLayerError,
  TooManyPagesError,
} from '../domain/DomainError';

const NOW = new Date('2026-11-03T10:00:00Z');
const MODEL = 'eu.anthropic.claude-haiku-4-5-20251001-v1:0';
const USAGE: Usage = { inputTokens: 1000, outputTokens: 500 };
// 1000 * 1.1 + 500 * 5.5
const COST = 3850;
const PROMPT = 'v-test';
const LATENCY = 1234;
const RUN: ModelRun = {
  modelId: MODEL,
  promptVersion: PROMPT,
  usage: USAGE,
  costMicroUsd: COST,
  latencyMs: LATENCY,
};
const base = { modelId: MODEL, promptVersion: PROMPT, usage: USAGE, latencyMs: LATENCY };
const SENTENCE = 'Der Mieter zahlt eine Kaution von sechs Monatsmieten.';
const PAGE = `${SENTENCE} ${'Dies ist ein längerer Vertragstext mit genügend Zeichen. '.repeat(3)}`;

const clause = (quote: string): LlmClause => ({
  category: 'deposit',
  level: 'critical',
  quote,
  reason: 'Zu hoch',
});

function setup(
  opts: {
    status?: 'pending_upload' | 'running';
    expiresAt?: Date;
    missing?: boolean;
    markRunning?: boolean;
    pages?: string[];
    extractError?: Error;
    budgetOk?: boolean;
    result?: AnalysisResult | Error | (AnalysisResult | Error)[];
    putTextError?: Error;
  } = {},
) {
  const analysis = new Analysis({
    id: 'a1',
    status: opts.status ?? 'pending_upload',
    contractType: 'rental',
    language: 'de',
    createdAt: NOW,
    expiresAt: opts.expiresAt ?? new Date('2026-12-03T10:00:00Z'),
    deleteTokenHash: 'hash',
  });
  const calls = {
    saved: [] as Analysis[],
    added: [] as number[],
    deleted: [] as string[],
    texts: [] as string[],
    analysed: 0,
    startedAt: [] as Date[],
    stages: [] as string[],
  };
  const results = [
    opts.result ?? { ok: true, ...base, clauses: [clause(SENTENCE)], invalidClauses: 0 },
  ].flat();
  const adapters: AnalyseContractAdapters = {
    analysisStore: {
      get: () => Promise.resolve(opts.missing ? undefined : analysis),
      markRunning: (_id, startedAt) => {
        calls.startedAt.push(startedAt);
        return Promise.resolve(opts.markRunning ?? true);
      },
      markStage: (_id, stage) => {
        calls.stages.push(stage);
        return Promise.resolve();
      },
      saveResult: (a) => {
        calls.saved.push(a);
        return Promise.resolve();
      },
    },
    documentStore: {
      getPdf: () => Promise.resolve(new Uint8Array([1])),
      putText: (_id, text) => {
        calls.texts.push(text);
        return opts.putTextError ? Promise.reject(opts.putTextError) : Promise.resolve();
      },
      deletePdf: (key) => {
        calls.deleted.push(key);
        return Promise.resolve();
      },
    },
    textExtractor: {
      extract: () =>
        opts.extractError
          ? Promise.reject(opts.extractError)
          : Promise.resolve(opts.pages ?? [PAGE]),
    },
    budget: {
      hasRemainingBudget: () => Promise.resolve(opts.budgetOk ?? true),
      add: (cost) => {
        calls.added.push(cost);
        return Promise.resolve();
      },
    },
    analyser: {
      analyse: () => {
        // The last result repeats if the use case asks more often than results were given.
        const result = results[Math.min(calls.analysed, results.length - 1)];
        if (!result) throw new Error('no fake result configured');
        calls.analysed++;
        return result instanceof Error ? Promise.reject(result) : Promise.resolve(result);
      },
    },
    clock: { now: () => NOW },
  };
  const run = () =>
    new AnalyseContract(adapters).execute({ analysisId: 'a1', key: 'uploads/a1.pdf' });
  return { run, calls, analysis };
}

describe('AnalyseContract', () => {
  it('stores a done analysis with verified clauses and the full model run', async () => {
    const { run, calls, analysis } = setup();
    await run();
    expect(analysis.status).toBe('done');
    expect(analysis.clauses).toHaveLength(1);
    expect(analysis.clauses[0]?.quote).toBe(SENTENCE);
    expect(analysis.run).toEqual(RUN);
    expect(calls.added).toEqual([COST]);
    expect(calls.saved).toEqual([analysis]);
    expect(calls.texts).toHaveLength(1);
    expect(calls.deleted).toEqual(['uploads/a1.pdf']);
  });

  it('stores the page starts and page count of the extracted text', async () => {
    const { run, analysis } = setup({ pages: [PAGE, PAGE] });
    await run();
    expect(analysis.status).toBe('done');
    expect(analysis.pageCount).toBe(2);
    expect(analysis.pageStarts).toEqual([0, PAGE.trim().length + 2]);
  });

  it('fails with BUDGET_EXHAUSTED without touching the PDF content or the model', async () => {
    const { run, calls, analysis } = setup({ budgetOk: false });
    await run();
    expect(analysis.failureReason).toBe('BUDGET_EXHAUSTED');
    expect(analysis.run).toBeUndefined();
    expect(calls.analysed).toBe(0);
    expect(calls.added).toEqual([]);
    expect(calls.deleted).toEqual(['uploads/a1.pdf']);
  });

  it('fails with INVALID_PDF', async () => {
    const { run, analysis } = setup({ extractError: new InvalidPdfError() });
    await run();
    expect(analysis.failureReason).toBe('INVALID_PDF');
  });

  it('fails with TOO_MANY_PAGES', async () => {
    const { run, analysis, calls } = setup({ pages: Array<string>(MAX_PDF_PAGES + 1).fill(PAGE) });
    await run();
    expect(analysis.failureReason).toBe('TOO_MANY_PAGES');
    expect(calls.analysed).toBe(0);
  });

  it('accepts exactly the maximum number of pages', async () => {
    const { run, analysis } = setup({ pages: Array<string>(MAX_PDF_PAGES).fill(PAGE) });
    await run();
    expect(analysis.status).toBe('done');
  });

  it('fails with NO_TEXT_LAYER for a scanned PDF', async () => {
    const { run, analysis, calls } = setup({ pages: ['', '  '] });
    await run();
    expect(analysis.failureReason).toBe('NO_TEXT_LAYER');
    expect(analysis.run).toBeUndefined();
    expect(calls.analysed).toBe(0);
  });

  const invalid: AnalysisResult = { ok: false, reason: 'invalid_output', ...base };
  const valid: AnalysisResult = {
    ok: true,
    ...base,
    clauses: [clause(SENTENCE)],
    invalidClauses: 0,
  };
  const SUMMED: ModelRun = {
    ...RUN,
    usage: { inputTokens: 2000, outputTokens: 1000 },
    costMicroUsd: 2 * COST,
    latencyMs: 2 * LATENCY,
  };

  it('retries once when the output is invalid and sums both calls', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const { run, analysis, calls } = setup({ result: [invalid, valid] });
      await run();
      expect(analysis.status).toBe('done');
      expect(calls.analysed).toBe(2);
      expect(calls.added).toEqual([COST, COST]);
      expect(analysis.run).toEqual(SUMMED);
      expect(warn).toHaveBeenCalledWith({
        msg: 'analysis output invalid, retrying once',
        analysisId: 'a1',
      });
    } finally {
      warn.mockRestore();
    }
  });

  it('fails with LLM_INVALID_OUTPUT after two invalid outputs and sums both calls', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { run, analysis, calls } = setup({ result: [invalid, invalid] });
    await run();
    expect(analysis.failureReason).toBe('LLM_INVALID_OUTPUT');
    expect(calls.analysed).toBe(2);
    expect(calls.added).toEqual([COST, COST]);
    expect(analysis.run).toEqual(SUMMED);
    expect(calls.saved).toHaveLength(1);
  });

  it('does not retry a truncated output', async () => {
    const { run, analysis, calls } = setup({ result: { ok: false, reason: 'truncated', ...base } });
    await run();
    expect(analysis.failureReason).toBe('LLM_INVALID_OUTPUT');
    expect(calls.analysed).toBe(1);
    expect(calls.added).toEqual([COST]);
    expect(analysis.run).toEqual(RUN);
  });

  it('returns status and failure reason', async () => {
    expect(await setup().run()).toEqual({ status: 'done', failureReason: undefined });
    expect(await setup({ pages: [] }).run()).toMatchObject({ status: 'failed' });
    expect(await setup({ missing: true }).run()).toBeUndefined();
  });

  it('fails when every quote is dropped', async () => {
    const { run, analysis, calls } = setup({
      result: { ok: true, ...base, clauses: [clause('steht nicht im Text')], invalidClauses: 0 },
    });
    await run();
    expect(analysis.failureReason).toBe('LLM_INVALID_OUTPUT');
    expect(analysis.run).toEqual(RUN);
    expect(calls.added).toEqual([COST]);
  });

  it('fails when every clause was schema-invalid', async () => {
    const { run, analysis, calls } = setup({
      result: { ok: true, ...base, clauses: [], invalidClauses: 2 },
    });
    await run();
    expect(analysis.failureReason).toBe('LLM_INVALID_OUTPUT');
    expect(analysis.run).toEqual(RUN);
    expect(calls.added).toEqual([COST]);
  });

  it('stores invalidClauses as invalidClauses', async () => {
    const { run, analysis } = setup({
      result: { ok: true, ...base, clauses: [clause(SENTENCE)], invalidClauses: 2 },
    });
    await run();
    expect(analysis.status).toBe('done');
    expect(analysis.invalidClauses).toBe(2);
    expect(analysis.unverifiedQuotes).toBe(0);
  });

  it('keeps the verified clauses and counts the dropped ones', async () => {
    const { run, analysis } = setup({
      result: {
        ok: true,
        ...base,
        clauses: [clause(SENTENCE), clause('steht nicht im Text')],
        invalidClauses: 0,
      },
    });
    await run();
    expect(analysis.status).toBe('done');
    expect(analysis.clauses).toHaveLength(1);
    expect(analysis.unverifiedQuotes).toBe(1);
    expect(analysis.invalidClauses).toBe(0);
  });

  it('treats zero clauses from the model as a success', async () => {
    const { run, analysis, calls } = setup({
      result: { ok: true, ...base, clauses: [], invalidClauses: 0 },
    });
    await run();
    expect(analysis.status).toBe('done');
    expect(analysis.clauses).toHaveLength(0);
    expect(calls.added).toEqual([COST]);
  });

  it('marks the stage analysing right before the Bedrock call', async () => {
    const { run, calls, analysis } = setup();
    await run();
    expect(calls.stages).toEqual(['analysing']);
    expect(analysis.stage).toBeUndefined();
  });

  it('does not mark a stage when extraction fails', async () => {
    const { run, calls } = setup({ extractError: new InvalidPdfError() });
    await run();
    expect(calls.stages).toEqual([]);
  });

  it('does not mark a stage on a duplicate event', async () => {
    const { run, calls } = setup({ markRunning: false });
    await run();
    expect(calls.stages).toEqual([]);
  });

  it('records the start time from the clock', async () => {
    const { run, calls, analysis } = setup();
    await run();
    expect(calls.startedAt).toEqual([NOW]);
    expect(analysis.startedAt).toEqual(NOW);
  });

  it('does nothing on a duplicate event', async () => {
    const { run, calls, analysis } = setup({ markRunning: false });
    await run();
    expect(analysis.status).toBe('pending_upload');
    expect(calls.saved).toEqual([]);
    expect(calls.deleted).toEqual([]);
    expect(calls.analysed).toBe(0);
  });

  it('does nothing for an expired analysis', async () => {
    const { run, calls } = setup({ expiresAt: new Date('2026-11-03T10:00:00Z') });
    await run();
    expect(calls.saved).toEqual([]);
    expect(calls.deleted).toEqual([]);
  });

  it('does nothing for an unknown analysis', async () => {
    const { run, calls } = setup({ missing: true });
    await run();
    expect(calls.saved).toEqual([]);
  });

  it('maps an unexpected error to INTERNAL and does not leak it', async () => {
    const { run, analysis, calls } = setup({ result: new Error('Bedrock throttled') });
    await run();
    expect(analysis.failureReason).toBe('INTERNAL');
    expect(calls.saved).toHaveLength(1);
    expect(calls.deleted).toEqual(['uploads/a1.pdf']);
  });

  it('logs the message of AWS SDK errors only', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const denied = Object.assign(new Error('not authorized to perform bedrock:InvokeModel'), {
        name: 'AccessDeniedException',
        $metadata: { httpStatusCode: 403 },
      });
      await setup({ result: denied }).run();
      await setup({ result: new Error('contract text leak') }).run();
      expect(spy).toHaveBeenNthCalledWith(1, {
        msg: 'analysis failed',
        analysisId: 'a1',
        name: 'AccessDeniedException',
        message: 'not authorized to perform bedrock:InvokeModel',
      });
      expect(spy).toHaveBeenNthCalledWith(2, {
        msg: 'analysis failed',
        analysisId: 'a1',
        name: 'Error',
      });
    } finally {
      spy.mockRestore();
    }
  });

  it('deletes the PDF when storing the text fails', async () => {
    const { run, analysis, calls } = setup({ putTextError: new Error('S3 down') });
    await run();
    expect(analysis.failureReason).toBe('INTERNAL');
    expect(calls.deleted).toEqual(['uploads/a1.pdf']);
  });
});

describe('toFailureReason', () => {
  it.each([
    [new BudgetExhaustedError(), 'BUDGET_EXHAUSTED'],
    [new InvalidPdfError(), 'INVALID_PDF'],
    [new TooManyPagesError(), 'TOO_MANY_PAGES'],
    [new NoTextLayerError(), 'NO_TEXT_LAYER'],
    [new LlmInvalidOutputError(), 'LLM_INVALID_OUTPUT'],
    [new Error('boom'), 'INTERNAL'],
    ['not an error', 'INTERNAL'],
  ])('%s → %s', (err, reason) => {
    expect(toFailureReason(err)).toBe(reason);
  });
});
