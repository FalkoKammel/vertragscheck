export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    attempts: number;
    delayMs: number;
    onRetry?: (attempt: number, error: unknown) => void;
    sleep?: (ms: number) => Promise<void>;
  },
): Promise<T> {
  const sleep =
    options.sleep ??
    ((ms: number) =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
      }));
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (attempt >= options.attempts) throw e;
      options.onRetry?.(attempt, e);
      await sleep(options.delayMs);
    }
  }
}
