// @vitest-environment jsdom
import { http } from 'msw/http';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { NetworkError, S3UploadError } from './errors';
import { uploadToS3 } from './s3-upload';

const URL = 'https://bucket.s3.eu-central-1.amazonaws.com/';
const ticket = { url: URL, fields: { key: 'uploads/1.pdf', 'Content-Type': 'application/pdf' } };
const file = new File(['%PDF-1.7'], 'vertrag.pdf', { type: 'application/pdf' });

// The real bucket answers with these through its CORS rule; jsdom enforces CORS like a browser.
const cors = { 'access-control-allow-origin': '*' };
// A progress listener on xhr.upload makes the browser send a preflight request first.
const preflight = http.options(
  URL,
  () =>
    new Response(null, {
      status: 204,
      headers: { ...cors, 'access-control-allow-methods': 'POST' },
    }),
);

const server = setupServer(preflight);
beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

describe('uploadToS3', () => {
  it('sends all ticket fields first and the file last, and reports completion', async () => {
    let names: string[] = [];
    server.use(
      http.post(URL, async ({ request }) => {
        const body = await request.text();
        names = [...body.matchAll(/Content-Disposition: form-data; name="([^"]+)"/g)].map(
          (match) => match[1] ?? '',
        );
        return new Response(null, { status: 204, headers: cors });
      }),
    );
    const progress: number[] = [];

    await uploadToS3(ticket, file, (fraction) => progress.push(fraction));

    expect(names).toEqual(['key', 'Content-Type', 'file']);
    expect(progress.at(-1)).toBe(1);
  });

  it.each([400, 403])('rejects with an S3UploadError for status %i', async (status) => {
    server.use(http.post(URL, () => new Response(null, { status, headers: cors })));
    await expect(uploadToS3(ticket, file, () => undefined)).rejects.toEqual(
      new S3UploadError(status),
    );
  });

  it('rejects with a NetworkError when the request fails', async () => {
    server.use(http.post(URL, () => Response.error()));
    await expect(uploadToS3(ticket, file, () => undefined)).rejects.toBeInstanceOf(NetworkError);
  });
});
