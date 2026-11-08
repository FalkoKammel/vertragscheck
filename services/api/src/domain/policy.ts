export const DAILY_LIMIT = 3;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const UPLOAD_TTL_SECONDS = 5 * 60;
export const RETENTION_DAYS = 30;
export const MAX_PDF_PAGES = 30;
export const RUNNING_TIMEOUT_MS = 5 * 60 * 1000;
export const UPLOAD_TIMEOUT_MS = 15 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

/** UTC calendar day as `YYYY-MM-DD`. */
export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** UTC month as `YYYY-MM`. */
export function monthKey(date: Date): string {
  return date.toISOString().slice(0, 7);
}

export function expiresAt(createdAt: Date): Date {
  return new Date(createdAt.getTime() + RETENTION_DAYS * DAY_MS);
}
