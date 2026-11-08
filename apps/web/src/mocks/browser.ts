import { setupWorker } from 'msw/browser';
import { http, HttpResponse } from 'msw/http';
import { analysisFixture, FIXTURE_STATES, type FixtureState } from './analysisFixtures';

const MOCK_S3_URL = 'https://mock-uploads.s3.eu-central-1.amazonaws.com/';

// Add ?mock=captcha, limit, budget or internal to the page URL to get that error from the API.
// On /result?id=<id>, ?mock=pending_upload, running (extracting), analysing, done (default), failed or notfound picks the
// answer of GET /api/analyses/:id.
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
    // Fake S3, with a short delay so the progress card is visible.
    http.post(MOCK_S3_URL, async () => {
      await new Promise((resolve) => setTimeout(resolve, 800));
      return new HttpResponse(null, { status: 204 });
    }),
  );
  await worker.start({ onUnhandledFrame: 'bypass' });
}
