export interface DeletesAnalysis {
  delete(analysisId: string): Promise<void>;
}
