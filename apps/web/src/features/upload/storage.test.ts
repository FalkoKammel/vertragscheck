import { describe, expect, it } from 'vitest';
import { ANALYSES_STORAGE_KEY, saveAnalysis, type StoredAnalysis } from './storage';

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
