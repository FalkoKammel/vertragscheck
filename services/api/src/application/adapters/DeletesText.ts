export interface DeletesText {
  deleteText(analysisId: string): Promise<void>;
}
