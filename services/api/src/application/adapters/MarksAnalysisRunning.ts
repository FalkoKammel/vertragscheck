export interface MarksAnalysisRunning {
  markRunning: (analysisId: string, startedAt: Date) => Promise<boolean>;
}
