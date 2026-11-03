import { z } from 'zod';

export const ANALYSES_STORAGE_KEY = 'vertragscheck.analyses';

const storedAnalysisSchema = z.object({
  analysisId: z.string(),
  deleteToken: z.string(),
  fileName: z.string(),
  contractType: z.enum(['rental', 'employment']),
  createdAt: z.string(),
});

export type StoredAnalysis = z.infer<typeof storedAnalysisSchema>;

// store Analysis in local storage
export function saveAnalysis(entry: StoredAnalysis, storage?: Storage): void {
  try {
    const target = storage ?? globalThis.localStorage;
    let existing: StoredAnalysis[] = [];
    try {
      const parsed = z
        .array(storedAnalysisSchema)
        .safeParse(JSON.parse(target.getItem(ANALYSES_STORAGE_KEY) ?? '[]'));
      if (parsed.success) existing = parsed.data;
    } catch {
      // corrupt JSON: start a fresh list
    }
    target.setItem(ANALYSES_STORAGE_KEY, JSON.stringify([entry, ...existing]));
  } catch {
    // storage unavailable
  }
}
