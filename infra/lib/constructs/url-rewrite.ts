import { readdirSync } from 'node:fs';
import { join, posix } from 'node:path';

// Small page for unknown URLs. Answered by the CloudFront Function itself, because
// CloudFront does not run functions on origin errors and a distribution-wide custom
// error response would also replace the API's own 403/404 answers (decision 023).
// Plain colours from the design (ink, body text, accent), no external assets.
const NOT_FOUND_HTML = [
  '<!DOCTYPE html><html lang="de"><head><meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width, initial-scale=1">',
  '<meta name="robots" content="noindex"><title>404 · Vertragscheck</title>',
  '<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;',
  'background:#F5F6F8;color:#3D4552;font-family:Inter,system-ui,sans-serif;text-align:center}',
  'h1{color:#14181F;font-size:1.5rem;margin:0 0 .5rem}a{color:#1F4E8C}</style></head>',
  '<body><main><h1>404</h1>',
  '<p>Seite nicht gefunden. <a href="/de">Zur Startseite</a></p>',
  '<p lang="en">Page not found. <a href="/en">Back to the start page</a></p>',
  '</main></body></html>',
].join('');

/**
 * Pages of the static export as request paths (`/de/upload.html`). This is the list of
 * URLs the function lets through to S3. The export also contains files that are not
 * pages visitors should reach, so they are left out and get the 404 page instead:
 * - `404.html` and `_not-found.html`: Next's own error pages,
 * - `index.html`: the root page, which is never served because `/` is redirected to `/de`,
 * - everything under `_next/`: scripts and styles, which have a file extension anyway.
 */
export function listPages(assetPath: string): string[] {
  const pages: string[] = [];
  const walk = (dir: string, prefix: string) => {
    for (const entry of readdirSync(join(assetPath, dir), { withFileTypes: true })) {
      if (entry.name.startsWith('_')) continue;
      const path = posix.join(prefix, entry.name);
      if (entry.isDirectory()) walk(join(dir, entry.name), path);
      else if (entry.name.endsWith('.html') && path !== '/404.html' && path !== '/index.html') {
        pages.push(path);
      }
    }
  };
  walk('.', '/');
  return pages.sort();
}

/**
 * Source of the CloudFront Function (runtime cloudfront-js-2.0, viewer request).
 * It must stay plain ES5-style JavaScript, so it lives in a string.
 * The Next.js export writes /de/upload as de/upload.html, so clean URLs get
 * ".html" appended. "/" redirects to the default language. A clean URL that is not
 * one of `pages` gets a 404 right here.
 */
export function urlRewriteCode(pages: readonly string[]): string {
  const known = Object.fromEntries(pages.map((page) => [page, true]));
  return `
var PAGES = ${JSON.stringify(known)};
var NOT_FOUND = ${JSON.stringify(NOT_FOUND_HTML)};

function handler(event) {
  var request = event.request;
  var uri = request.uri;

  if (uri === '/') {
    return {
      statusCode: 302,
      statusDescription: 'Found',
      headers: { location: { value: '/de' } },
    };
  }

  if (uri.charAt(uri.length - 1) === '/') {
    uri = uri.slice(0, -1);
  }

  var lastSegment = uri.substring(uri.lastIndexOf('/') + 1);
  if (lastSegment.indexOf('.') === -1) {
    uri += '.html';
    if (!Object.prototype.hasOwnProperty.call(PAGES, uri)) {
      return {
        statusCode: 404,
        statusDescription: 'Not Found',
        headers: {
          'content-type': { value: 'text/html; charset=utf-8' },
          'cache-control': { value: 'public, max-age=60' },
        },
        body: { encoding: 'text', data: NOT_FOUND },
      };
    }
  }

  request.uri = uri;
  return request;
}
`;
}
