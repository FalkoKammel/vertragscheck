import { createHash, randomBytes } from 'node:crypto';
import type { GeneratedToken, GeneratesToken } from '../application/adapters/GeneratesToken';

export class RandomTokenGenerator implements GeneratesToken {
  generate(): GeneratedToken {
    const token = randomBytes(32).toString('base64url');
    return { token, hash: createHash('sha256').update(token).digest('hex') };
  }
}
