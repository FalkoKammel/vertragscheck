import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { listPages, urlRewriteCode } from '../lib/constructs/url-rewrite.js';

interface Request {
  uri: string;
}
interface Response {
  statusCode: number;
  headers: Record<string, { value: string }>;
  body?: { encoding: string; data: string };
}
type Handler = (event: { request: Request }) => Request | Response;

const PAGES = [
  '/de.html',
  '/en.html',
  '/de/upload.html',
  '/de/result.html',
  '/de/transparency.html',
  '/en/upload.html',
  '/en/result.html',
  '/en/transparency.html',
];

// Run the exact code that is deployed to CloudFront.
const handler = runInNewContext(`${urlRewriteCode(PAGES)}
handler`) as Handler;

const rewrite = (uri: string) => handler({ request: { uri } });

describe('url rewrite', () => {
  it('redirects / to /de', () => {
    expect(rewrite('/')).toMatchObject({
      statusCode: 302,
      headers: { location: { value: '/de' } },
    });
  });

  it.each([
    ['/de', '/de.html'],
    ['/en', '/en.html'],
    ['/de/upload', '/de/upload.html'],
    ['/en/transparency', '/en/transparency.html'],
    ['/de/result', '/de/result.html'],
  ])('maps %s to %s', (uri, expected) => {
    expect(rewrite(uri)).toEqual({ uri: expected });
  });

  it('ignores a trailing slash', () => {
    expect(rewrite('/de/upload/')).toEqual({ uri: '/de/upload.html' });
    expect(rewrite('/de/')).toEqual({ uri: '/de.html' });
  });

  it.each(['/404.html', '/_next/static/chunks/app.js', '/de.txt', '/favicon.ico'])(
    'leaves %s untouched',
    (uri) => {
      expect(rewrite(uri)).toEqual({ uri });
    },
  );

  it.each(['/nope', '/de/nope', '/fr', '/de/upload/extra', '/constructor', '/__proto__'])(
    'answers 404 with an HTML page for the unknown page %s',
    (uri) => {
      const res = rewrite(uri) as Response;
      expect(res.statusCode).toBe(404);
      expect(res.headers['content-type']?.value).toBe('text/html; charset=utf-8');
      expect(res.body?.data).toContain('<meta name="robots" content="noindex">');
      expect(res.body?.data).toContain('href="/de"');
    },
  );

  it('stays well below the 10 KB limit of CloudFront Functions', () => {
    expect(Buffer.byteLength(urlRewriteCode(PAGES))).toBeLessThan(5_000);
  });
});

describe('listPages', () => {
  it('lists exported pages, but not 404, index or underscore files', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vc-pages-'));
    mkdirSync(join(dir, 'de'));
    mkdirSync(join(dir, '_next', 'static'), { recursive: true });
    mkdirSync(join(dir, '_not-found'));
    for (const file of [
      '404.html',
      'index.html',
      '_not-found.html',
      'de.html',
      'de.txt',
      'de/upload.html',
      '_next/static/a.html',
      '_not-found/x.html',
    ]) {
      writeFileSync(join(dir, file), '');
    }
    expect(listPages(dir)).toEqual(['/de.html', '/de/upload.html']);
  });
});
