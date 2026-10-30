import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { urlRewriteCode } from '../lib/constructs/url-rewrite.js';

interface Request {
  uri: string;
}
interface Redirect {
  statusCode: number;
  headers: { location: { value: string } };
}
type Handler = (event: { request: Request }) => Request | Redirect;

// Run the exact code that is deployed to CloudFront.
const handler = runInNewContext(`${urlRewriteCode}
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
});
