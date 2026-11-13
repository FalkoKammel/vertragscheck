import type { AnalysisStage } from '../../domain/analysis';

export interface MarksAnalysisStage {
  markStage: (analysisId: string, stage: AnalysisStage) => Promise<boolean>;
}
