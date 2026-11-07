export interface MarksAnalysisRunning {
  markRunning: (analysisId: string) => Promise<boolean>;
}
