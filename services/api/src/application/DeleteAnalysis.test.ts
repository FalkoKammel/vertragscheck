import { describe, expect, it } from 'vitest';
import { Analysis, ANALYSIS_STATUSES } from '../domain/analysis';
import { hashDeleteToken } from '../domain/deleteToken';
import { AnalysisNotFoundError, InvalidDeleteTokenError } from '../domain/DomainError';
import { DeleteAnalysis } from './DeleteAnalysis';

const NOW = new Date('2026-11-03T10:00:00Z');
const TOKEN = 'the-right-token';

function setup(opts: { status?: Analysis['status']; expiresAt?: Date } = {}) {
  const analysis = new Analysis({
    id: 'a1',
    status: opts.status ?? 'done',
    contractType: 'rental',
    language: 'de',
    createdAt: NOW,
    expiresAt: opts.expiresAt ?? new Date('2026-12-03T10:00:00Z'),
    deleteTokenHash: hashDeleteToken(TOKEN),
  });
  const calls: string[] = [];
  let exists = true;
  const useCase = new DeleteAnalysis({
    analysisStore: {
      get: () => Promise.resolve(exists ? analysis : undefined),
      delete: (id) => {
        calls.push(`item:${id}`);
        exists = false;
        return Promise.resolve();
      },
    },
    documentStore: {
      deleteText: (id) => {
        calls.push(`text:${id}`);
        return Promise.resolve();
      },
      deletePdf: (key) => {
        calls.push(`pdf:${key}`);
        return Promise.resolve();
      },
    },
    clock: { now: () => NOW },
  });
  return {
    run: (token = TOKEN) => useCase.execute({ analysisId: 'a1', deleteToken: token }),
    calls,
  };
}

describe('DeleteAnalysis', () => {
  it('deletes the text, then the pdf, then the item', async () => {
    const { run, calls } = setup();
    await run();
    expect(calls).toEqual(['text:a1', 'pdf:uploads/a1.pdf', 'item:a1']);
  });

  it('rejects a wrong token and deletes nothing', async () => {
    const { run, calls } = setup();
    await expect(run('wrong')).rejects.toThrow(InvalidDeleteTokenError);
    expect(calls).toEqual([]);
  });

  it('throws not found for an expired analysis', async () => {
    const { run, calls } = setup({ expiresAt: NOW });
    await expect(run()).rejects.toThrow(AnalysisNotFoundError);
    expect(calls).toEqual([]);
  });

  it('answers not found the second time', async () => {
    const { run } = setup();
    await run();
    await expect(run()).rejects.toThrow(AnalysisNotFoundError);
  });

  it.each(ANALYSIS_STATUSES)('allows deleting a %s analysis', async (status) => {
    const { run, calls } = setup({ status });
    await run();
    expect(calls).toHaveLength(3);
  });
});
