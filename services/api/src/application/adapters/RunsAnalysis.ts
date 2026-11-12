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
} & (
  | { ok: true; clauses: LlmClause[]; invalidClauses: number }
  | {
      ok: false;
      // 'truncated': hit max_tokens, a retry would fail the same way.
      // 'invalid_output': the tool output had the wrong shape, a retry may succeed.
      reason: 'truncated' | 'invalid_output';
    }
);

export interface RunsAnalysis {
  analyse(request: AnalysisRequest): Promise<AnalysisResult>;
}
