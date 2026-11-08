export interface GetsText {
  getText(analysisId: string): Promise<string | undefined>;
}
