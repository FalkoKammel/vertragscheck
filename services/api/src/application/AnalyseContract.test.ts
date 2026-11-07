import { describe, expect, it } from 'vitest';
import { Analysis } from '../domain/analysis';
import type { Usage } from '../domain/analysis';
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
    result?: AnalysisResult | Error;
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
  };
  const result: AnalysisResult | Error = opts.result ?? {
    ok: true,
    modelId: MODEL,
    usage: USAGE,
    clauses: [clause(SENTENCE)],
  };
  const adapters: AnalyseContractAdapters = {
    analysisStore: {
      get: () => Promise.resolve(opts.missing ? undefined : analysis),
      markRunning: () => Promise.resolve(opts.markRunning ?? true),
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
  it('stores a done analysis with verified clauses, usage and cost', async () => {
    const { run, calls, analysis } = setup();
    await run();
    expect(analysis.status).toBe('done');
    expect(analysis.clauses).toHaveLength(1);
    expect(analysis.clauses[0]?.quote).toBe(SENTENCE);
    expect(analysis.usage).toEqual(USAGE);
    expect(analysis.costMicroUsd).toBe(COST);
    expect(calls.added).toEqual([COST]);
    expect(calls.saved).toEqual([analysis]);
    expect(calls.texts).toHaveLength(1);
    expect(calls.deleted).toEqual(['uploads/a1.pdf']);
  });

  it('fails with BUDGET_EXHAUSTED without touching the PDF content or the model', async () => {
    const { run, calls, analysis } = setup({ budgetOk: false });
    await run();
    expect(analysis.failureReason).toBe('BUDGET_EXHAUSTED');
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
    expect(calls.analysed).toBe(0);
  });

  it('still books the cost when the model output is invalid', async () => {
    const { run, analysis, calls } = setup({ result: { ok: false, modelId: MODEL, usage: USAGE } });
    await run();
    expect(analysis.failureReason).toBe('LLM_INVALID_OUTPUT');
    expect(calls.added).toEqual([COST]);
    expect(analysis.costMicroUsd).toBe(COST);
    expect(analysis.usage).toEqual(USAGE);
    expect(calls.saved).toHaveLength(1);
  });

  it('fails when every quote is dropped', async () => {
    const { run, analysis, calls } = setup({
      result: { ok: true, modelId: MODEL, usage: USAGE, clauses: [clause('steht nicht im Text')] },
    });
    await run();
    expect(analysis.failureReason).toBe('LLM_INVALID_OUTPUT');
    expect(calls.added).toEqual([COST]);
  });

  it('keeps the verified clauses and counts the dropped ones', async () => {
    const { run, analysis } = setup({
      result: {
        ok: true,
        modelId: MODEL,
        usage: USAGE,
        clauses: [clause(SENTENCE), clause('steht nicht im Text')],
      },
    });
    await run();
    expect(analysis.status).toBe('done');
    expect(analysis.clauses).toHaveLength(1);
    expect(analysis.quotesDropped).toBe(1);
  });

  it('treats zero clauses from the model as a success', async () => {
    const { run, analysis, calls } = setup({
      result: { ok: true, modelId: MODEL, usage: USAGE, clauses: [] },
    });
    await run();
    expect(analysis.status).toBe('done');
    expect(analysis.clauses).toHaveLength(0);
    expect(calls.added).toEqual([COST]);
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
