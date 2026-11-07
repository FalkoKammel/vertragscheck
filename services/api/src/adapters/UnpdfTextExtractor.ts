import { extractText, getDocumentProxy } from 'unpdf';
import type { ExtractsText } from '../application/adapters/ExtractsText';
import { InvalidPdfError } from '../domain/DomainError';

export class UnpdfTextExtractor implements ExtractsText {
  async extract(pdf: Uint8Array): Promise<string[]> {
    try {
      const doc = await getDocumentProxy(pdf);
      const { text } = await extractText(doc, { mergePages: false });
      return text;
    } catch {
      throw new InvalidPdfError();
    }
  }
}
