import type { GetAnalysisOutput } from '../application/GetAnalysis';
import type { FailureReason, AnalysisStatus, ContractType, Language } from '../domain/analysis';
import type { StoredClause } from '../domain/schemas';

/** The JSON body of `GET /api/analyses/{id}`. The frontend validates it with its own Zod schema. */
export interface AnalysisResponse {
  id: string;
  status: AnalysisStatus;
  contractType: ContractType;
  language: Language;
  createdAt: string;
  expiresAt: string;
  failureReason?: FailureReason;
  result?: {
    text: string;
    clauses: StoredClause[];
    unverifiedQuotes: number;
    invalidClauses: number;
    run: {
      modelId: string;
      promptVersion: string;
      costMicroUsd: number;
      latencyMs: number;
      inputTokens: number;
      outputTokens: number;
    };
  };
}

/** Builds the response field by field, so internal fields never leak (deleteTokenHash, startedAt). */
export function toAnalysisResponse(output: GetAnalysisOutput): AnalysisResponse {
  const { analysis, status, failureReason, text } = output;
  const response: AnalysisResponse = {
    id: analysis.id,
    status,
    contractType: analysis.contractType,
    language: analysis.language,
    createdAt: analysis.createdAt.toISOString(),
    expiresAt: analysis.expiresAt.toISOString(),
  };
  if (status === 'failed' && failureReason) response.failureReason = failureReason;
  if (status === 'done' && text !== undefined && analysis.run) {
    const { usage, modelId, promptVersion, costMicroUsd, latencyMs } = analysis.run;
    response.result = {
      text,
      clauses: analysis.clauses.map((c) => ({ ...c })),
      unverifiedQuotes: analysis.unverifiedQuotes,
      invalidClauses: analysis.invalidClauses,
      run: {
        modelId,
        promptVersion,
        costMicroUsd,
        latencyMs,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
      },
    };
  }
  return response;
}
