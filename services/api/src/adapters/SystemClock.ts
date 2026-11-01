import type { ProvidesTime } from '../application/adapters/ProvidesTime';

export class SystemClock implements ProvidesTime {
  now(): Date {
    return new Date();
  }
}
