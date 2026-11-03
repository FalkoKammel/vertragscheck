import { ApiError, NetworkError, S3UploadError } from '../../lib/api/errors';

/** Keys below `Upload.errors` in the message files. */
export type UploadErrorKey =
  'captchaInvalid' | 'dailyLimit' | 'budgetExhausted' | 'network' | 'uploadRejected' | 'internal';

const KEY_BY_API_CODE: Record<string, UploadErrorKey> = {
  CAPTCHA_INVALID: 'captchaInvalid',
  DAILY_LIMIT_REACHED: 'dailyLimit',
  BUDGET_EXHAUSTED: 'budgetExhausted',
  INTERNAL: 'internal',
};

export function errorMessageKey(error: unknown): UploadErrorKey {
  if (error instanceof ApiError) return KEY_BY_API_CODE[error.code] ?? 'internal';
  if (error instanceof NetworkError) return 'network';
  if (error instanceof S3UploadError) {
    return error.status === 400 || error.status === 403 ? 'uploadRejected' : 'internal';
  }
  return 'internal';
}
