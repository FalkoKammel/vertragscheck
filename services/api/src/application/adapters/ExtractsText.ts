export interface ExtractsText {
  /** One string per page. Throws InvalidPdfError for broken or encrypted files. */
  extract(pdf: Uint8Array): Promise<string[]>;
}
