import { vi } from 'vitest';
import type { AnalysisResponse } from '../lib/api/analyses';

type Reply = AnalysisResponse | 'notfound' | 'network';

/**
 * Replaces `fetch` for `GET /api/analyses/:id`. Each call takes the next reply from the script;
 * the last one repeats. Returns the mock so tests can count requests.
 */
export function fakeAnalysisApi(script: Reply[]) {
  let call = 0;
  const mock = vi.fn((): Promise<Response> => {
    const reply = script[Math.min(call, script.length - 1)];
    call += 1;
    if (reply === 'network') return Promise.reject(new TypeError('Failed to fetch'));
    if (reply === 'notfound' || reply === undefined) {
      return Promise.resolve(Response.json({ code: 'ANALYSIS_NOT_FOUND' }, { status: 404 }));
    }
    return Promise.resolve(Response.json(reply));
  });
  vi.stubGlobal('fetch', mock);
  return mock;
}
