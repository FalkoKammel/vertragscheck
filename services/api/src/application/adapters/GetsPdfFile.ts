export interface GetsPdfFile {
  getPdf(key: string): Promise<Uint8Array>;
}
