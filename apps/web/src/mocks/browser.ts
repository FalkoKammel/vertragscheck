import { setupWorker } from 'msw/browser';
import { http, HttpResponse } from 'msw/http';
import { analysisFixture, FIXTURE_STATES, type FixtureState } from './analysisFixtures';

const MOCK_S3_URL = 'https://mock-uploads.s3.eu-central-1.amazonaws.com/';

// Add ?mock=captcha, limit, budget or internal to the page URL to get that error from the API.
const API_ERRORS: Record<string, { status: number; code: string }> = {
  captcha: { status: 403, code: 'CAPTCHA_INVALID' },
  limit: { status: 429, code: 'DAILY_LIMIT_REACHED' },
  budget: { status: 503, code: 'BUDGET_EXHAUSTED' },
  internal: { status: 500, code: 'INTERNAL' },
};

function fixtureState(): FixtureState | 'notfound' {
  const value = new URLSearchParams(window.location.search).get('mock');
  if (value === 'notfound') return value;
  return FIXTURE_STATES.find((state) => state === value) ?? 'done';
}

let started: Promise<unknown> | undefined;

/** Starts the fake API once. React StrictMode runs effects twice in development. */
export function startMocking(): Promise<unknown> {
  started ??= startWorker();
  return started;
}

async function startWorker(): Promise<void> {
  const worker = setupWorker(
    http.post('/api/uploads', () => {
      const error = API_ERRORS[new URLSearchParams(window.location.search).get('mock') ?? ''];
      if (error) return HttpResponse.json({ code: error.code }, { status: error.status });

      return HttpResponse.json(
        {
          analysisId: crypto.randomUUID(),
          deleteToken: crypto.randomUUID(),
          uploadTicket: { url: MOCK_S3_URL, fields: { key: 'uploads/mock.pdf' } },
        },
        { status: 201 },
      );
    }),
    http.get('/api/analyses/:id', ({ params }) => {
      const state = fixtureState();
      if (state === 'notfound') {
        return HttpResponse.json({ code: 'ANALYSIS_NOT_FOUND' }, { status: 404 });
      }
      const id = typeof params.id === 'string' ? params.id : 'mock';
      return HttpResponse.json(analysisFixture(state, id), {
        headers: { 'cache-control': 'no-store' },
      });
    }),
    http.get('/api/stats', () => {
      const mock = new URLSearchParams(window.location.search).get('mock');
      if (mock === 'internal') return HttpResponse.json({ code: 'INTERNAL' }, { status: 500 });
      const empty = mock === 'empty';
      return HttpResponse.json({
        month: '2026-11',
        analyses: { done: empty ? 0 : 184, failed: empty ? 0 : 3 },
        meanCostMicroUsd: empty ? null : 13_000,
        p95LatencyMs: empty ? null : 9_800,
        unverifiedQuotes: { num: empty ? 0 : 21, den: empty ? 0 : 1000 },
        budget: { spentMicroUsd: empty ? 0 : 2_400_000, limitMicroUsd: 10_000_000 },
        activeModelId: 'eu.anthropic.claude-sonnet-4-6',
      });
    }),
    // ?mock=delete403 or delete404 for the error answers; everything else deletes.
    http.delete('/api/analyses/:id', () => {
      const mock = new URLSearchParams(window.location.search).get('mock');
      if (mock === 'delete403') {
        return HttpResponse.json({ code: 'INVALID_DELETE_TOKEN' }, { status: 403 });
      }
      if (mock === 'delete404') {
        return HttpResponse.json({ code: 'ANALYSIS_NOT_FOUND' }, { status: 404 });
      }
      return new HttpResponse(null, { status: 204 });
    }),
    // Fake S3, with a short delay so the progress card is visible.
    http.post(MOCK_S3_URL, async () => {
      await new Promise((resolve) => setTimeout(resolve, 800));
      return new HttpResponse(null, { status: 204 });
    }),
  );
  await worker.start({ onUnhandledFrame: 'bypass' });
}
