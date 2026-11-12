import { describe, expect, it } from 'vitest';
import { InvalidPdfError } from '../domain/DomainError';
import { assemblePage, UnpdfTextExtractor, type PdfTextItem } from './UnpdfTextExtractor';

// Smallest valid one-page PDF with a text layer; xref offsets are computed
function pdfWithText(text: string): Uint8Array {
  const stream = `BT /F1 12 Tf 20 100 Td (${text}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${String(stream.length)} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${String(i + 1)} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${String(objects.length + 1)}\n0000000000 65535 f \n`;
  for (const o of offsets) out += `${String(o).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${String(objects.length + 1)} /Root 1 0 R >>\nstartxref\n${String(xref)}\n%%EOF`;
  return new TextEncoder().encode(out);
}

describe('UnpdfTextExtractor', () => {
  it('returns one string per page', async () => {
    const pages = await new UnpdfTextExtractor().extract(pdfWithText('Kaution drei Monatsmieten'));
    expect(pages).toHaveLength(1);
    expect(pages[0]).toContain('Kaution drei Monatsmieten');
  });

  it('throws InvalidPdfError for a file that is not a PDF', async () => {
    await expect(
      new UnpdfTextExtractor().extract(new TextEncoder().encode('not a pdf')),
    ).rejects.toBeInstanceOf(InvalidPdfError);
  });
});

function item(str: string, y: number, hasEOL = true): PdfTextItem {
  return { str, transform: [12, 0, 0, 12, 50, y], hasEOL };
}

describe('assemblePage', () => {
  it('joins items of one line and breaks at hasEOL', () => {
    const text = assemblePage([
      item('Die Miete ', 700, false),
      item('beträgt 900 €.', 700),
      item('Sie ist fällig.', 686),
    ]);
    expect(text).toBe('Die Miete beträgt 900 €.\nSie ist fällig.');
  });
  it('emits a blank line for a gap clearly larger than the line spacing', () => {
    const text = assemblePage([
      item('§ 1 Miete', 700),
      item('Die Miete beträgt', 686),
      item('900 €.', 672),
      item('§ 2 Kaution', 640),
      item('Drei Monatsmieten.', 626),
    ]);
    expect(text).toBe('§ 1 Miete\nDie Miete beträgt\n900 €.\n\n§ 2 Kaution\nDrei Monatsmieten.');
  });
  it('does not insert blank lines for evenly spaced lines', () => {
    expect(assemblePage([item('a', 700), item('b', 686), item('c', 672)])).toBe('a\nb\nc');
  });
  it('returns an empty string for an empty page', () => {
    expect(assemblePage([])).toBe('');
  });
});
