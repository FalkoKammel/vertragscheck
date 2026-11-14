import { describe, expect, it } from 'vitest';
import { ContractText } from 'api/src/domain/ContractText';
import { analysisResponseSchema } from '../../apps/web/src/lib/api/analyses';
import { SAMPLE_CREATED_AT, buildSampleResponse, type SuccessfulResult } from './sampleResponse';

const TEXT = ContractText.fromExtracted([
  'Mietvertrag\n\n§ 1 Schönheitsreparaturen\n\n(1) Der Mieter renoviert alle 3 Jahre die Wohnung.\n\n§ 2 Kaution\n\n(1) Die Kaution beträgt zwei Nettokaltmieten.',
]);

const MODEL = 'eu.anthropic.claude-sonnet-4-6';

function result(quotes: string[]): SuccessfulResult {
  return {
    ok: true,
    modelId: MODEL,
    promptVersion: 'v4',
    usage: { inputTokens: 1000, outputTokens: 200 },
    latencyMs: 4200,
    invalidClauses: 1,
    clauses: quotes.map((quote) => ({
      category: 'cosmetic_repairs',
      level: 'critical' as const,
      quote,
      reason: 'Starre Fristen sind voraussichtlich unwirksam.',
    })),
  };
}

function build(quotes: string[]) {
  return buildSampleResponse({
    sampleId: 'sample-rental',
    contractType: 'rental',
    language: 'de',
    text: TEXT,
    result: result(quotes),
  });
}

describe('buildSampleResponse', () => {
  it('returns a done response that the web schema accepts', () => {
    const response = build(['Der Mieter renoviert alle 3 Jahre die Wohnung.']);
    expect(analysisResponseSchema.safeParse(response).success).toBe(true);
    expect(response).toMatchObject({
      id: 'sample-rental',
      status: 'done',
      contractType: 'rental',
      language: 'de',
      createdAt: SAMPLE_CREATED_AT.toISOString(),
      pageCount: 1,
    });
  });

  it('carries the verified clauses with offsets into the text', () => {
    const clauses = build(['Der Mieter renoviert alle 3 Jahre die Wohnung.']).result?.clauses;
    expect(clauses).toHaveLength(1);
    const [clause] = clauses ?? [];
    expect(TEXT.value.slice(clause?.start, clause?.end)).toContain('renoviert alle 3 Jahre');
  });

  it('counts dropped quotes and prices the run', () => {
    const response = build([
      'Der Mieter renoviert alle 3 Jahre die Wohnung.',
      'Diesen Satz gibt es nicht im Vertrag.',
    ]);
    expect(response.result?.unverifiedQuotes).toBe(1);
    expect(response.result?.invalidClauses).toBe(1);
    // 1000 × $3.30/M + 200 × $16.50/M = 6600 µUSD
    expect(response.result?.run).toMatchObject({ costMicroUsd: 6600, latencyMs: 4200 });
  });

  it('contains no delete token', () => {
    expect(JSON.stringify(build(['Der Mieter renoviert alle 3 Jahre die Wohnung.']))).not.toMatch(
      /delete/i,
    );
  });
});
