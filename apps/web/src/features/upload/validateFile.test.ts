import { describe, expect, it } from 'vitest';
import { MAX_FILE_BYTES, validateFile } from './validateFile';

const pdf = { name: 'vertrag.pdf', type: 'application/pdf', size: 1000 };

describe('validateFile', () => {
  it('accepts a PDF', () => {
    expect(validateFile(pdf)).toEqual({ ok: true });
  });

  it('accepts exactly 10 MB and rejects one byte more', () => {
    expect(validateFile({ ...pdf, size: MAX_FILE_BYTES })).toEqual({ ok: true });
    expect(validateFile({ ...pdf, size: MAX_FILE_BYTES + 1 })).toEqual({
      ok: false,
      problem: 'tooLarge',
    });
  });

  it('rejects other file types', () => {
    expect(validateFile({ name: 'foto.png', type: 'image/png', size: 10 })).toEqual({
      ok: false,
      problem: 'notPdf',
    });
  });

  it('falls back to the extension when the browser gives no MIME type', () => {
    expect(validateFile({ name: 'Vertrag.PDF', type: '', size: 10 })).toEqual({ ok: true });
    expect(validateFile({ name: 'vertrag.docx', type: '', size: 10 })).toEqual({
      ok: false,
      problem: 'notPdf',
    });
  });

  it('rejects an empty file', () => {
    expect(validateFile({ ...pdf, size: 0 })).toEqual({ ok: false, problem: 'empty' });
  });
});
