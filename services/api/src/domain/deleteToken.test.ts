import { describe, expect, it } from 'vitest';
import { deleteTokenMatches, hashDeleteToken } from './deleteToken';

describe('deleteToken', () => {
  const hash = hashDeleteToken('secret-token');

  it('hashes to 64 hex characters', () => {
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('matches the token it was made from', () => {
    expect(deleteTokenMatches('secret-token', hash)).toBe(true);
  });

  it('rejects another token', () => {
    expect(deleteTokenMatches('other-token', hash)).toBe(false);
  });

  it('returns false instead of throwing when the stored hash has another length', () => {
    expect(deleteTokenMatches('secret-token', hash.slice(0, 32))).toBe(false);
    expect(deleteTokenMatches('secret-token', '')).toBe(false);
  });

  it('returns false for a stored value that is not hex', () => {
    expect(deleteTokenMatches('secret-token', 'zz'.repeat(32))).toBe(false);
  });
});
