import { describe, expect, it } from 'vitest';
import { ApiError, NetworkError, S3UploadError } from '../../lib/api/errors';
import { errorMessageKey } from './errorMessageKey';

describe('errorMessageKey', () => {
  it.each([
    ['CAPTCHA_INVALID', 'captchaInvalid'],
    ['DAILY_LIMIT_REACHED', 'dailyLimit'],
    ['BUDGET_EXHAUSTED', 'budgetExhausted'],
    ['INTERNAL', 'internal'],
    ['INVALID_REQUEST', 'internal'],
    ['SOMETHING_NEW', 'internal'],
  ])('maps API code %s to %s', (code, key) => {
    expect(errorMessageKey(new ApiError(code))).toBe(key);
  });

  it('maps network errors', () => {
    expect(errorMessageKey(new NetworkError())).toBe('network');
  });

  it.each([
    [400, 'uploadRejected'],
    [403, 'uploadRejected'],
    [500, 'internal'],
    [404, 'internal'],
  ])('maps S3 status %i to %s', (status, key) => {
    expect(errorMessageKey(new S3UploadError(status))).toBe(key);
  });

  it('treats anything else as internal', () => {
    expect(errorMessageKey(new Error('boom'))).toBe('internal');
    expect(errorMessageKey(undefined)).toBe('internal');
  });
});
