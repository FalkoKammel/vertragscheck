export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export type FileProblem = 'empty' | 'notPdf' | 'tooLarge';

export type FileValidation = { ok: true } | { ok: false; problem: FileProblem };

export function validateFile(file: { name: string; type: string; size: number }): FileValidation {
  const looksLikePdf =
    file.type === 'application/pdf' || (file.type === '' && /\.pdf$/i.test(file.name));
  if (!looksLikePdf) return { ok: false, problem: 'notPdf' };
  if (file.size === 0) return { ok: false, problem: 'empty' };
  if (file.size > MAX_FILE_BYTES) return { ok: false, problem: 'tooLarge' };
  return { ok: true };
}
