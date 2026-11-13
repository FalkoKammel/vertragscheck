// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import {
  ANALYSES_CHANGED_EVENT,
  ANALYSES_STORAGE_KEY,
  findStoredAnalysis,
  readStoredAnalyses,
  removeStoredAnalysis,
  saveAnalysis,
  type StoredAnalysis,
} from './storage';

function fakeStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    clear: () => {
      data.clear();
    },
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, value),
  };
}

const entry = (analysisId: string): StoredAnalysis => ({
  analysisId,
  deleteToken: 'token',
  fileName: 'vertrag.pdf',
  contractType: 'rental',
  createdAt: '2026-11-03T10:00:00.000Z',
});

describe('saveAnalysis', () => {
  it('stores the newest analysis first', () => {
    const storage = fakeStorage();
    saveAnalysis(entry('a'), storage);
    saveAnalysis(entry('b'), storage);
    const list = JSON.parse(storage.getItem(ANALYSES_STORAGE_KEY) ?? '[]') as StoredAnalysis[];
    expect(list.map((item) => item.analysisId)).toEqual(['b', 'a']);
  });

  it('starts a fresh list when the stored data is corrupt', () => {
    const storage = fakeStorage({ [ANALYSES_STORAGE_KEY]: '{not json' });
    saveAnalysis(entry('a'), storage);
    expect(JSON.parse(storage.getItem(ANALYSES_STORAGE_KEY) ?? '[]')).toHaveLength(1);
  });

  it('does not throw when storage is unavailable or full', () => {
    const broken = fakeStorage();
    broken.setItem = () => {
      throw new DOMException('full', 'QuotaExceededError');
    };
    expect(() => {
      saveAnalysis(entry('a'), broken);
    }).not.toThrow();
  });
});

describe('findStoredAnalysis', () => {
  it('finds a saved entry by ID', () => {
    const storage = fakeStorage();
    saveAnalysis(entry('a'), storage);
    saveAnalysis(entry('b'), storage);
    expect(findStoredAnalysis('a', storage)?.analysisId).toBe('a');
  });

  it('returns undefined for unknown IDs and corrupt storage', () => {
    expect(findStoredAnalysis('x', fakeStorage())).toBeUndefined();
    expect(
      findStoredAnalysis('x', fakeStorage({ [ANALYSES_STORAGE_KEY]: '{not json' })),
    ).toBeUndefined();
  });
});

describe('readStoredAnalyses and removeStoredAnalysis', () => {
  it('returns the entries newest first', () => {
    const storage = fakeStorage();
    saveAnalysis({ ...entry('old'), createdAt: '2026-10-01T10:00:00.000Z' }, storage);
    saveAnalysis({ ...entry('new'), createdAt: '2026-11-01T10:00:00.000Z' }, storage);
    saveAnalysis({ ...entry('mid'), createdAt: '2026-10-15T10:00:00.000Z' }, storage);
    expect(readStoredAnalyses(storage).map((e) => e.analysisId)).toEqual(['new', 'mid', 'old']);
  });

  it('removes one entry and keeps the others', () => {
    const storage = fakeStorage();
    saveAnalysis(entry('a1'), storage);
    saveAnalysis(entry('a2'), storage);
    removeStoredAnalysis('a1', storage);
    expect(readStoredAnalyses(storage).map((e) => e.analysisId)).toEqual(['a2']);
  });

  it('survives storage that throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    } as unknown as Storage;
    expect(readStoredAnalyses(broken)).toEqual([]);
    expect(() => {
      removeStoredAnalysis('a1', broken);
    }).not.toThrow();
  });

  it('announces saves and removals', () => {
    const listener = vi.fn();
    globalThis.addEventListener(ANALYSES_CHANGED_EVENT, listener);
    const storage = fakeStorage();
    saveAnalysis(entry('a1'), storage);
    removeStoredAnalysis('a1', storage);
    expect(listener).toHaveBeenCalledTimes(2);
    globalThis.removeEventListener(ANALYSES_CHANGED_EVENT, listener);
  });
});
