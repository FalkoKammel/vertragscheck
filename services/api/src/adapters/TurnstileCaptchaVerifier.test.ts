import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TurnstileCaptchaVerifier } from './TurnstileCaptchaVerifier';

const post = vi.hoisted(() => vi.fn());
vi.mock('axios', () => ({ default: { post } }));

const verifier = new TurnstileCaptchaVerifier('the-secret', 'site.example');
const warn = vi.fn();

function respond(data: unknown) {
  post.mockResolvedValue({ data });
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(warn);
});
afterEach(() => {
  vi.restoreAllMocks();
  warn.mockReset();
  post.mockReset();
});

describe('TurnstileCaptchaVerifier', () => {
  it('accepts a successful answer for the expected hostname', async () => {
    respond({ success: true, hostname: 'site.example' });
    expect(await verifier.verify('token', '203.0.113.7')).toBe(true);
    expect(warn).not.toHaveBeenCalled();
  });

  it('logs Cloudflare error codes when the token is rejected', async () => {
    respond({ success: false, 'error-codes': ['invalid-input-secret'] });
    expect(await verifier.verify('token', '203.0.113.7')).toBe(false);
    expect(warn).toHaveBeenCalledWith({
      msg: 'captcha rejected',
      reason: 'rejected_by_cloudflare',
      errorCodes: ['invalid-input-secret'],
    });
  });

  it('logs both hostnames on a mismatch', async () => {
    respond({ success: true, hostname: 'example.com' });
    expect(await verifier.verify('token', '203.0.113.7')).toBe(false);
    expect(warn).toHaveBeenCalledWith({
      msg: 'captcha rejected',
      reason: 'hostname_mismatch',
      received: 'example.com',
      expected: 'site.example',
    });
  });

  it('fails closed on an unexpected answer and on network errors', async () => {
    respond({ nope: 1 });
    expect(await verifier.verify('token', '203.0.113.7')).toBe(false);
    post.mockRejectedValue(new Error('timeout'));
    expect(await verifier.verify('token', '203.0.113.7')).toBe(false);
    expect(warn).toHaveBeenNthCalledWith(1, {
      msg: 'captcha rejected',
      reason: 'unexpected_response',
    });
    expect(warn).toHaveBeenNthCalledWith(2, {
      msg: 'captcha rejected',
      reason: 'request_failed',
      error: 'Error',
    });
  });

  it('never logs the token, the secret or the IP', async () => {
    respond({ success: false, 'error-codes': ['invalid-input-response'] });
    await verifier.verify('secret-token-123', '203.0.113.7');
    const logged = JSON.stringify(warn.mock.calls);
    for (const sensitive of ['secret-token-123', 'the-secret', '203.0.113.7']) {
      expect(logged).not.toContain(sensitive);
    }
  });
});
