import { randomBytes } from 'node:crypto';
import type { GeneratedToken, GeneratesToken } from '../application/adapters/GeneratesToken';
import { hashDeleteToken } from '../domain/deleteToken';

export class RandomTokenGenerator implements GeneratesToken {
  generate(): GeneratedToken {
    const token = randomBytes(32).toString('base64url');
    return { token, hash: hashDeleteToken(token) };
  }
}
