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

function readAnalyses(target: Storage): StoredAnalysis[] {
  try {
    const parsed = z
      .array(storedAnalysisSchema)
      .safeParse(JSON.parse(target.getItem(ANALYSES_STORAGE_KEY) ?? '[]'));
    return parsed.success ? parsed.data : [];
  } catch {
    // corrupt JSON: treat as an empty list
    return [];
  }
}

// store Analysis in local storage
export function saveAnalysis(entry: StoredAnalysis, storage?: Storage): void {
  try {
    const target = storage ?? globalThis.localStorage;
    target.setItem(ANALYSES_STORAGE_KEY, JSON.stringify([entry, ...readAnalyses(target)]));
  } catch {
    // storage unavailable
  }
}

/** The entry this browser saved for an analysis, if any. */
export function findStoredAnalysis(
  analysisId: string,
  storage?: Storage,
): StoredAnalysis | undefined {
  try {
    const target = storage ?? globalThis.localStorage;
    return readAnalyses(target).find((entry) => entry.analysisId === analysisId);
  } catch {
    return undefined;
  }
}
