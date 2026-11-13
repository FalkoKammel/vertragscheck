import { createHash, timingSafeEqual } from 'node:crypto';

export function hashDeleteToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function deleteTokenMatches(token: string, storedHashHex: string): boolean {
  const actual = Buffer.from(hashDeleteToken(token), 'hex');
  const expected = Buffer.from(storedHashHex, 'hex');
  // timingSafeEqual throws on different lengths (e.g. a corrupt stored value).
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
