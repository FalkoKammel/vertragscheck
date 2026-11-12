import type { GetAnalysisOutput } from '../application/GetAnalysis';
import type {
  AnalysisStage,
  FailureReason,
  AnalysisStatus,
  ContractType,
  Language,
} from '../domain/analysis';
import type { StoredClause } from '../domain/schemas';

export interface AnalysisResponse {
  id: string;
  status: AnalysisStatus;
  contractType: ContractType;
  language: Language;
  createdAt: string;
  expiresAt: string;
  stage?: AnalysisStage;
  failureReason?: FailureReason;
  pageCount?: number;
  result?: {
    text: string;
    pageStarts?: number[];
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
  if (status === 'running' && analysis.stage) response.stage = analysis.stage;
  if (status === 'failed' && failureReason) response.failureReason = failureReason;
  if (status === 'done' && text !== undefined && analysis.run) {
    const { usage, modelId, promptVersion, costMicroUsd, latencyMs } = analysis.run;
    if (analysis.pageCount !== undefined) response.pageCount = analysis.pageCount;
    response.result = {
      text,
      ...(analysis.pageStarts ? { pageStarts: [...analysis.pageStarts] } : {}),
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
