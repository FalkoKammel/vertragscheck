import type { ContractType, Language, Usage } from '../../domain/analysis';
import type { LlmClause } from '../../domain/schemas';

export interface AnalysisRequest {
  contractType: ContractType;
  language: Language;
  text: string;
}

export type AnalysisResult = {
  modelId: string;
  promptVersion: string;
  usage: Usage;
  latencyMs: number;
} & ({ ok: true; clauses: LlmClause[]; invalidClauses: number } | { ok: false });

export interface RunsAnalysis {
  analyse(request: AnalysisRequest): Promise<AnalysisResult>;
}
