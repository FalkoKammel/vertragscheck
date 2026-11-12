import { getDocumentProxy } from 'unpdf';
import type { ExtractsText } from '../application/adapters/ExtractsText';
import { InvalidPdfError } from '../domain/DomainError';

export interface PdfTextItem {
  str: string;
  transform: number[];
  hasEOL: boolean;
}

const PARAGRAPH_GAP_FACTOR = 1.5;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const upper = sorted[mid] ?? 0;
  const lower = sorted[mid - 1] ?? upper;
  return sorted.length % 2 === 0 ? (lower + upper) / 2 : upper;
}

// Builds the text of one page: a line ends at hasEOL, a gap clearly larger
// than the typical line spacing becomes a blank line (paragraph break)
export function assemblePage(items: readonly PdfTextItem[]): string {
  const lines: { text: string; y: number }[] = [];
  let text = '';
  let y: number | undefined;
  for (const item of items) {
    y ??= item.transform[5] ?? 0;
    text += item.str;
    if (item.hasEOL) {
      lines.push({ text, y });
      text = '';
      y = undefined;
    }
  }
  if (text.length > 0 || y !== undefined) lines.push({ text, y: y ?? 0 });

  const nonEmpty = lines.filter((l) => l.text.trim().length > 0);
  const gaps: number[] = [];
  for (let i = 1; i < nonEmpty.length; i++) {
    const gap = Math.abs((nonEmpty[i - 1]?.y ?? 0) - (nonEmpty[i]?.y ?? 0));
    if (gap > 0) gaps.push(gap);
  }
  const threshold = gaps.length > 0 ? median(gaps) * PARAGRAPH_GAP_FACTOR : Infinity;

  let out = '';
  nonEmpty.forEach((line, i) => {
    if (i > 0) {
      const gap = Math.abs((nonEmpty[i - 1]?.y ?? 0) - line.y);
      out += gap > threshold ? '\n\n' : '\n';
    }
    out += line.text;
  });
  return out;
}

export class UnpdfTextExtractor implements ExtractsText {
  async extract(pdf: Uint8Array): Promise<string[]> {
    try {
      const doc = await getDocumentProxy(pdf);
      const pages: string[] = [];
      for (let n = 1; n <= doc.numPages; n++) {
        const page = await doc.getPage(n);
        const content = await page.getTextContent();
        const items: PdfTextItem[] = [];
        for (const item of content.items) {
          if ('str' in item) {
            items.push({
              str: item.str,
              transform: Array.from(item.transform, (v: unknown) => Number(v)),
              hasEOL: item.hasEOL,
            });
          }
        }
        pages.push(assemblePage(items));
      }
      return pages;
    } catch {
      throw new InvalidPdfError();
    }
  }
}
