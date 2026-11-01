import type { Analysis } from '../../domain/Analysis';

export interface StoresAnalysis {
  save(analysis: Analysis): Promise<void>;
}
