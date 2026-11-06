import { describe, expect, it } from 'vitest';
import { UnknownModelPriceError } from './DomainError';
import { calculateCostMicroUsd, MODEL_PRICES } from './pricing';

const HAIKU = 'eu.anthropic.claude-haiku-4-5-20251001-v1:0';

describe('calculateCostMicroUsd', () => {
  it('prices input and output tokens per million (USD per M equals micro-USD per token)', () => {
    // 1,000,000 * 1.1 + 1,000,000 * 5.5 USD-micro = 6.6 USD
    expect(calculateCostMicroUsd(HAIKU, { inputTokens: 1_000_000, outputTokens: 1_000_000 })).toBe(
      6_600_000,
    );
  });

  it('costs nothing for zero usage', () => {
    expect(calculateCostMicroUsd(HAIKU, { inputTokens: 0, outputTokens: 0 })).toBe(0);
  });

  it('prices a typical analysis', () => {
    // 7412 * 1.1 + 1388 * 5.5 = 8153.2 + 7634 = 15787.2 -> 15788
    expect(calculateCostMicroUsd(HAIKU, { inputTokens: 7412, outputTokens: 1388 })).toBe(15_788);
  });

  it('rounds up to a whole micro-USD so the budget is never undercounted', () => {
    // 1 * 1.1 = 1.1 -> 2
    expect(calculateCostMicroUsd(HAIKU, { inputTokens: 1, outputTokens: 0 })).toBe(2);
  });

  it('returns an integer', () => {
    const cost = calculateCostMicroUsd(HAIKU, { inputTokens: 12_345, outputTokens: 6_789 });
    expect(Number.isInteger(cost)).toBe(true);
  });

  it('prices cache reads at 10 % of the input price', () => {
    expect(
      calculateCostMicroUsd(HAIKU, { inputTokens: 0, outputTokens: 0, cacheReadTokens: 1_000_000 }),
    ).toBe(110_000);
  });

  it('prices cache writes at 125 % of the input price', () => {
    expect(
      calculateCostMicroUsd(HAIKU, {
        inputTokens: 0,
        outputTokens: 0,
        cacheWriteTokens: 1_000_000,
      }),
    ).toBe(1_375_000);
  });

  it('adds all four token types', () => {
    expect(
      calculateCostMicroUsd(HAIKU, {
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
        cacheReadTokens: 1_000_000,
        cacheWriteTokens: 1_000_000,
      }),
    ).toBe(6_600_000 + 110_000 + 1_375_000);
  });

  it('throws UnknownModelPriceError for a model without a price', () => {
    expect(() =>
      calculateCostMicroUsd('eu.unknown.model-v1:0', { inputTokens: 1, outputTokens: 1 }),
    ).toThrow(UnknownModelPriceError);
  });

  it('has a price for the default model', () => {
    expect(MODEL_PRICES[HAIKU]).toEqual({ inputPerM: 1.1, outputPerM: 5.5 });
  });
});
