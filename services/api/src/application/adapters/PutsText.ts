export interface PutsText {
  putText(analysisId: string, text: string): Promise<void>;
}
