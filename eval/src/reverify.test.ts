import { ContractText } from 'api/src/domain/ContractText';
import { describe, expect, it } from 'vitest';
import type { Contract } from './load';
import type { CallRecord } from './results.schema';
import { reverifyCalls } from './reverify';

const contract = {
  id: 'rental-x',
  contractType: 'rental',
  description: '',
  text: ContractText.fromExtracted(['(1) Die Kaution ist fällig.\n\n(2) Haustiere sind verboten.']),
  expected: [],
  clean: [],
} as Contract;

function call(quote: string): CallRecord {
  return {
    contractId: 'rental-x',
    run: 1,
    result: {
      ok: true,
      modelId: 'm',
      promptVersion: 'v1',
      usage: { inputTokens: 1, outputTokens: 1 },
      latencyMs: 1,
      invalidClauses: 0,
      clauses: [{ category: 'pets', level: 'critical', quote, reason: 'r' }],
    },
    // stale verification from an older implementation
    verification: { clauses: [], unverifiedQuotes: 1 },
  };
}

describe('reverifyCalls', () => {
  it('replaces the stored verification and leaves the input untouched', () => {
    const input = [call('Die Kaution ist fällig. Haustiere sind verboten.')];
    const [out] = reverifyCalls([contract], input);

    expect(out?.verification).toMatchObject({ alignedQuotes: 1, unverifiedQuotes: 0 });
    expect(input[0]?.verification?.unverifiedQuotes).toBe(1);
  });

  it('returns failed calls and unknown contracts unchanged', () => {
    const failed: CallRecord = { contractId: 'rental-x', run: 1, error: 'boom' };
    const unknown = { ...call('x'), contractId: 'other' };
    expect(reverifyCalls([contract], [failed, unknown])).toEqual([failed, unknown]);
  });
});
