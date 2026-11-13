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

/** Fired on `window` after this tab changed the list (the `storage` event only reaches other tabs). */
export const ANALYSES_CHANGED_EVENT = 'vertragscheck:analyses-changed';

function notifyChanged(): void {
  try {
    globalThis.dispatchEvent(new Event(ANALYSES_CHANGED_EVENT));
  } catch {
    // no window (tests, server)
  }
}

// store Analysis in local storage
export function saveAnalysis(entry: StoredAnalysis, storage?: Storage): void {
  try {
    const target = storage ?? globalThis.localStorage;
    target.setItem(ANALYSES_STORAGE_KEY, JSON.stringify([entry, ...readAnalyses(target)]));
  } catch {
    // storage unavailable
    return;
  }
  notifyChanged();
}

/** All entries of this browser, newest first. Empty when storage is unavailable. */
export function readStoredAnalyses(storage?: Storage): StoredAnalysis[] {
  try {
    const target = storage ?? globalThis.localStorage;
    return readAnalyses(target).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  } catch {
    return [];
  }
}

export function removeStoredAnalysis(analysisId: string, storage?: Storage): void {
  try {
    const target = storage ?? globalThis.localStorage;
    const rest = readAnalyses(target).filter((entry) => entry.analysisId !== analysisId);
    target.setItem(ANALYSES_STORAGE_KEY, JSON.stringify(rest));
  } catch {
    // storage unavailable
    return;
  }
  notifyChanged();
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
