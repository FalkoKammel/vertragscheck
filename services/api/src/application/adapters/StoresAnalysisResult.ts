import type { Analysis } from '../../domain/analysis';

export interface StoresAnalysisResult {
  saveResult(analysis: Analysis): Promise<void>;
}
