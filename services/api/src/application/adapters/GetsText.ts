export interface GetsText {
  /** The extracted contract text, or undefined if there is none (never stored, or deleted). */
  getText(analysisId: string): Promise<string | undefined>;
}
