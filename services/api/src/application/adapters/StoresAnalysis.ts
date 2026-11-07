import type { Analysis } from '../../domain/analysis';

export interface StoresAnalysis {
  save(analysis: Analysis): Promise<void>;
}
