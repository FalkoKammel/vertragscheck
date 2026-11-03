import { setupWorker } from 'msw/browser';
import { http, HttpResponse } from 'msw/http';

const MOCK_S3_URL = 'https://mock-uploads.s3.eu-central-1.amazonaws.com/';

// Add ?mock=captcha, limit, budget or internal to the page URL to get that error from the API.
const API_ERRORS: Record<string, { status: number; code: string }> = {
  captcha: { status: 403, code: 'CAPTCHA_INVALID' },
  limit: { status: 429, code: 'DAILY_LIMIT_REACHED' },
  budget: { status: 503, code: 'BUDGET_EXHAUSTED' },
  internal: { status: 500, code: 'INTERNAL' },
};

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
    // Fake S3, with a short delay so the progress card is visible.
    http.post(MOCK_S3_URL, async () => {
      await new Promise((resolve) => setTimeout(resolve, 800));
      return new HttpResponse(null, { status: 204 });
    }),
  );
  await worker.start({ onUnhandledFrame: 'bypass' });
}
