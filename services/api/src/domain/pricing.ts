import { UnknownModelPriceError } from './DomainError';

export interface ModelPrice {
  inputPerM: number;
  outputPerM: number;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

const CACHE_READ_FACTOR = 0.1;
const CACHE_WRITE_FACTOR = 1.25;

// USD per million tokens, EU inference profile (geo rate, already incl. +10%).
// Verified on aws.amazon.com/bedrock/pricing on 06.11.2026.
export const MODEL_PRICES: Record<string, ModelPrice> = {
  'eu.anthropic.claude-haiku-4-5-20251001-v1:0': { inputPerM: 1.1, outputPerM: 5.5 },
};

export function calculateCostMicroUsd(modelId: string, usage: Usage): number {
  const price = MODEL_PRICES[modelId];
  if (!price) throw new UnknownModelPriceError(modelId);
  return Math.ceil(
    usage.inputTokens * price.inputPerM +
      usage.outputTokens * price.outputPerM +
      (usage.cacheReadTokens ?? 0) * price.inputPerM * CACHE_READ_FACTOR +
      (usage.cacheWriteTokens ?? 0) * price.inputPerM * CACHE_WRITE_FACTOR,
  );
}
