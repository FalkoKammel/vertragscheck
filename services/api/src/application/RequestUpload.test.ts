import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { Analysis } from '../domain/analysis';
import {
  BudgetExhaustedError,
  CaptchaInvalidError,
  DailyLimitReachedError,
} from '../domain/DomainError';
import { DAILY_LIMIT, MAX_UPLOAD_BYTES, UPLOAD_TTL_SECONDS } from '../domain/policy';
import { RequestUpload, type RequestUploadInput } from './RequestUpload';

const NOW = new Date('2026-11-03T10:15:00Z');

const input: RequestUploadInput = {
  captchaToken: 'captcha',
  clientIp: '203.0.113.7',
  contractType: 'rental',
  language: 'de',
};

function setup(opts: { captcha?: boolean; budget?: boolean; allowed?: boolean } = {}) {
  const calls: string[] = [];
  const saved: Analysis[] = [];
  const tickets: { key: string; maxBytes: number; expiresInSeconds: number }[] = [];
  const limits: { ip: string; day: string; limit: number }[] = [];

  const useCase = new RequestUpload({
    captchaVerifier: {
      verify: () => {
        calls.push('captcha');
        return Promise.resolve(opts.captcha ?? true);
      },
    },
    budgetChecker: {
      hasRemainingBudget: () => {
        calls.push('budget');
        return Promise.resolve(opts.budget ?? true);
      },
    },
    rateLimiter: {
      tryConsume: (ip, day, limit) => {
        calls.push('limit');
        limits.push({ ip, day, limit });
        return Promise.resolve(opts.allowed ?? true);
      },
    },
    analysisStore: {
      save: (analysis) => {
        calls.push('save');
        saved.push(analysis);
        return Promise.resolve();
      },
    },
    uploadTicketIssuer: {
      issue: (params) => {
        calls.push('ticket');
        tickets.push(params);
        return Promise.resolve({ url: 'https://s3.example', fields: { key: params.key } });
      },
    },
    tokenGenerator: {
      generate: () => ({
        token: 'plain-token',
        hash: createHash('sha256').update('plain-token').digest('hex'),
      }),
    },
    idGenerator: { generate: () => 'analysis-1' },
    clock: { now: () => NOW },
  });
  return { useCase, calls, saved, tickets, limits };
}

describe('RequestUpload', () => {
  it('stores a pending analysis and returns id, delete token and upload ticket', async () => {
    const { useCase, calls, saved, tickets, limits } = setup();

    const out = await useCase.execute(input);

    expect(out).toEqual({
      analysisId: 'analysis-1',
      deleteToken: 'plain-token',
      uploadTicket: { url: 'https://s3.example', fields: { key: 'uploads/analysis-1.pdf' } },
    });
    expect(saved.map((a) => a.toProps())).toEqual([
      {
        id: 'analysis-1',
        status: 'pending_upload',
        contractType: 'rental',
        language: 'de',
        createdAt: NOW,
        expiresAt: new Date('2026-12-03T10:15:00Z'),
        deleteTokenHash: createHash('sha256').update('plain-token').digest('hex'),
        clauses: [],
        quotesDropped: 0,
        usage: undefined,
        costMicroUsd: 0,
        failureReason: undefined,
      },
    ]);
    expect(tickets).toEqual([
      {
        key: 'uploads/analysis-1.pdf',
        maxBytes: MAX_UPLOAD_BYTES,
        expiresInSeconds: UPLOAD_TTL_SECONDS,
      },
    ]);
    expect(limits).toEqual([{ ip: '203.0.113.7', day: '2026-11-03', limit: DAILY_LIMIT }]);
    expect(calls).toEqual(['captcha', 'budget', 'limit', 'save', 'ticket']);
  });

  it('rejects an invalid captcha before anything else happens', async () => {
    const { useCase, calls } = setup({ captcha: false });

    await expect(useCase.execute(input)).rejects.toBeInstanceOf(CaptchaInvalidError);
    expect(calls).toEqual(['captcha']);
  });

  it('rejects when the monthly budget is exhausted, before the rate limiter is used up', async () => {
    const { useCase, calls } = setup({ budget: false });

    await expect(useCase.execute(input)).rejects.toBeInstanceOf(BudgetExhaustedError);
    expect(calls).toEqual(['captcha', 'budget']);
  });

  it('rejects when the daily limit is reached and stores nothing', async () => {
    const { useCase, calls, saved } = setup({ allowed: false });

    await expect(useCase.execute(input)).rejects.toBeInstanceOf(DailyLimitReachedError);
    expect(calls).toEqual(['captcha', 'budget', 'limit']);
    expect(saved).toEqual([]);
  });

  it('stores only the hash of the delete token, never the token itself', async () => {
    const { useCase, saved } = setup();

    const out = await useCase.execute(input);

    const stored = saved[0];
    expect(stored?.deleteTokenHash).not.toBe(out.deleteToken);
    expect(stored?.deleteTokenHash).toBe(
      createHash('sha256').update(out.deleteToken).digest('hex'),
    );
    expect(JSON.stringify(stored?.toProps())).not.toContain(out.deleteToken);
  });
});
