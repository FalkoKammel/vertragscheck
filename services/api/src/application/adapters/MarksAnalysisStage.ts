import type { AnalysisStage } from '../../domain/analysis';

export interface MarksAnalysisStage {
  /** Only has an effect while the analysis is `running`. */
  markStage: (analysisId: string, stage: AnalysisStage) => Promise<void>;
}
