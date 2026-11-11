import type { AnalysisPhase } from '@/components/AnalysisProgress';
import type { AnalysisResponse, FailureReason } from '@/lib/api/analyses';
import { ApiError, NetworkError } from '@/lib/api/errors';

export type AnalysisErrorKey =
  | 'notFound'
  | 'network'
  | 'internal'
  | 'budgetExhausted'
  | 'invalidPdf'
  | 'tooManyPages'
  | 'noTextLayer'
  | 'llmInvalidOutput'
  | 'timeout'
  | 'uploadMissing';

const KEY_BY_FAILURE_REASON: Record<FailureReason, AnalysisErrorKey> = {
  BUDGET_EXHAUSTED: 'budgetExhausted',
  INVALID_PDF: 'invalidPdf',
  TOO_MANY_PAGES: 'tooManyPages',
  NO_TEXT_LAYER: 'noTextLayer',
  LLM_INVALID_OUTPUT: 'llmInvalidOutput',
  INTERNAL: 'internal',
  TIMEOUT: 'timeout',
  UPLOAD_MISSING: 'uploadMissing',
};

export function toPhase(analysis: AnalysisResponse | undefined): AnalysisPhase {
  if (analysis?.stage === 'analysing') return 'analysing';
  return 'extracting';
}

export function analysisErrorKey(
  analysis: AnalysisResponse | undefined,
  error: unknown,
): AnalysisErrorKey | null {
  if (error) {
    if (error instanceof ApiError && error.status === 404) return 'notFound';
    if (error instanceof NetworkError) return 'network';
    return 'internal';
  }
  if (analysis?.status === 'failed') {
    return analysis.failureReason ? KEY_BY_FAILURE_REASON[analysis.failureReason] : 'internal';
  }
  return null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isAnalysisId(id: string): boolean {
  return UUID.test(id);
}
