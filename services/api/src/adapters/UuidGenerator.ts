import { randomUUID } from 'node:crypto';
import type { GeneratesId } from '../application/adapters/GeneratesId';

export class UuidGenerator implements GeneratesId {
  generate(): string {
    return randomUUID();
  }
}
