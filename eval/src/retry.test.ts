import { describe, expect, it, vi } from 'vitest';
import { withRetry } from './retry';

const noSleep = () => Promise.resolve();

describe('withRetry', () => {
  it('returns the value after transient failures', async () => {
    const fn = vi.fn<() => Promise<string>>();
    fn.mockRejectedValueOnce(new Error('a'))
      .mockRejectedValueOnce(new Error('b'))
      .mockResolvedValue('ok');
    await expect(withRetry(fn, { attempts: 3, delayMs: 0, sleep: noSleep })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('throws the last error once attempts are used up', async () => {
    const fn = vi.fn<() => Promise<string>>().mockRejectedValue(new Error('nope'));
    await expect(withRetry(fn, { attempts: 2, delayMs: 0, sleep: noSleep })).rejects.toThrow(
      'nope',
    );
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does not retry on success', async () => {
    const fn = vi.fn<() => Promise<number>>().mockResolvedValue(1);
    await withRetry(fn, { attempts: 3, delayMs: 0, sleep: noSleep });
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
