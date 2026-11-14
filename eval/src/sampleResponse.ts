import { toAnalysisResponse, type AnalysisResponse } from 'api/src/adapters/AnalysisResponseMapper';
import type { AnalysisResult } from 'api/src/application/adapters/RunsAnalysis';
import type { ContractText } from 'api/src/domain/ContractText';
import { Analysis, type ContractType, type Language } from 'api/src/domain/analysis';
import { calculateCostMicroUsd } from 'api/src/domain/pricing';

/** Fixed so that the sample files only change when the analysis itself changes. */
export const SAMPLE_CREATED_AT = new Date('2026-11-14T00:00:00.000Z');
/** The response schema requires an expiry; samples never expire and the UI does not show it. */
export const SAMPLE_EXPIRES_AT = new Date('9999-12-31T23:59:59.000Z');

export type SuccessfulResult = Extract<AnalysisResult, { ok: true }>;

export interface SampleInput {
  sampleId: string;
  contractType: ContractType;
  language: Language;
  text: ContractText;
  result: SuccessfulResult;
}

/**
 * Builds the same `done` response that GET /api/analyses/{id} returns, through the production
 * mapper. No delete token (the hash is empty and never leaves the mapper), no TTL.
 */
export function buildSampleResponse(input: SampleInput): AnalysisResponse {
  const { sampleId, contractType, language, text, result } = input;
  const verification = text.verifyQuotes(result.clauses);
  const analysis = new Analysis({
    id: sampleId,
    status: 'done',
    contractType,
    language,
    createdAt: SAMPLE_CREATED_AT,
    expiresAt: SAMPLE_EXPIRES_AT,
    deleteTokenHash: '',
    clauses: verification.clauses,
    unverifiedQuotes: verification.unverifiedQuotes,
    invalidClauses: result.invalidClauses,
    pageStarts: [...text.pageStarts],
    pageCount: text.pageCount,
    run: {
      modelId: result.modelId,
      promptVersion: result.promptVersion,
      usage: result.usage,
      costMicroUsd: calculateCostMicroUsd(result.modelId, result.usage),
      latencyMs: result.latencyMs,
    },
  });
  return toAnalysisResponse({ analysis, status: 'done', text: text.value });
}
