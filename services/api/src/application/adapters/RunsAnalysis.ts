import type { ContractType, Language, Usage } from '../../domain/analysis';
import type { LlmClause } from '../../domain/schemas';

export interface AnalysisRequest {
  contractType: ContractType;
  language: Language;
  text: string;
}

export type AnalysisResult = { modelId: string; usage: Usage } & (
  { ok: true; clauses: LlmClause[] } | { ok: false }
);

export interface RunsAnalysis {
  analyse(request: AnalysisRequest): Promise<AnalysisResult>;
}
