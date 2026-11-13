import { describe, it, expect } from 'vitest';
import type { Clause } from '@/lib/api/analyses';
import { pageAt, segmentText } from './segmentText';

const TEXT = 'Die Miete beträgt 900 Euro. Die Kaution beträgt vier Monatsmieten.'; // 66 Zeichen

const c = (start: number, end: number, level: Clause['level']): Clause => ({
  category: 'deposit',
  level,
  quote: TEXT.slice(start, end),
  reason: 'x',
  start,
  end,
});

const joined = (segments: { text: string }[]) => segments.map((s) => s.text).join('');

describe('segmentText', () => {
  it('returns one plain segment without clauses', () => {
    expect(segmentText(TEXT, [])).toEqual([
      { start: 0, end: 66, text: TEXT, clauseIndexes: [], page: 1 },
    ]);
  });

  it('returns nothing for empty text', () => {
    expect(segmentText('', [])).toEqual([]);
  });

  it('marks a clause in the middle', () => {
    expect(segmentText(TEXT, [c(48, 65, 'critical')])).toEqual([
      { start: 0, end: 48, text: TEXT.slice(0, 48), clauseIndexes: [], page: 1 },
      {
        start: 48,
        end: 65,
        text: 'vier Monatsmieten',
        level: 'critical',
        clauseIndexes: [0],
        page: 1,
      },
      { start: 65, end: 66, text: '.', clauseIndexes: [], page: 1 },
    ]);
  });

  it('marks a clause at the very start', () => {
    const segments = segmentText(TEXT, [c(0, 27, 'fine')]);
    expect(segments[0]).toEqual({
      start: 0,
      end: 27,
      text: 'Die Miete beträgt 900 Euro.',
      level: 'fine',
      clauseIndexes: [0],
      page: 1,
    });
    expect(segments).toHaveLength(2);
  });

  it('orders by position but keeps the input indexes', () => {
    const segments = segmentText(TEXT, [c(48, 65, 'critical'), c(0, 27, 'fine')]);
    expect(segments.filter((s) => s.level).map((s) => s.clauseIndexes)).toEqual([[1], [0]]);
  });

  it('merges two clauses on the same range and takes the most severe level', () => {
    const segments = segmentText(TEXT, [c(48, 65, 'check'), c(48, 65, 'critical')]);
    expect(segments[1]).toEqual({
      start: 48,
      end: 65,
      text: 'vier Monatsmieten',
      level: 'critical',
      clauseIndexes: [0, 1],
      page: 1,
    });
  });

  it('splits partially overlapping clauses at every boundary', () => {
    const marked = segmentText(TEXT, [c(32, 52, 'check'), c(48, 65, 'critical')]).filter(
      (s) => s.level,
    );
    expect(marked).toEqual([
      { start: 32, end: 48, text: TEXT.slice(32, 48), level: 'check', clauseIndexes: [0], page: 1 },
      { start: 48, end: 52, text: 'vier', level: 'critical', clauseIndexes: [0, 1], page: 1 },
      { start: 52, end: 65, text: ' Monatsmieten', level: 'critical', clauseIndexes: [1], page: 1 },
    ]);
  });

  it('handles a clause nested inside another', () => {
    const marked = segmentText(TEXT, [c(28, 66, 'check'), c(48, 65, 'critical')]).filter(
      (s) => s.level,
    );
    expect(marked.map((s) => [s.start, s.end, s.level, s.clauseIndexes])).toEqual([
      [28, 48, 'check', [0]],
      [48, 65, 'critical', [0, 1]],
      [65, 66, 'check', [0]],
    ]);
  });

  it('ignores clauses with an invalid range', () => {
    expect(segmentText(TEXT, [c(10, 5, 'critical'), c(60, 80, 'critical')])).toEqual([
      { start: 0, end: 66, text: TEXT, clauseIndexes: [], page: 1 },
    ]);
  });

  it('always covers the full text without gaps', () => {
    const cases = [
      [],
      [c(0, 66, 'fine')],
      [c(32, 52, 'check'), c(48, 65, 'critical'), c(0, 3, 'fine')],
    ];
    for (const clauses of cases) {
      const segments = segmentText(TEXT, clauses);
      expect(joined(segments)).toBe(TEXT);
      segments.forEach((s, i) => {
        if (i > 0) expect(s.start).toBe(segments[i - 1]?.end);
      });
    }
  });

  describe('pages', () => {
    // page 1: 0-27, page 2: 27-48, page 3: 48-66
    const pageStarts = [0, 27, 48];

    it('splits at page starts and numbers the segments', () => {
      expect(segmentText(TEXT, [], pageStarts).map((s) => [s.start, s.end, s.page])).toEqual([
        [0, 27, 1],
        [27, 48, 2],
        [48, 66, 3],
      ]);
    });

    it('splits a clause at a page start and keeps its indexes on both parts', () => {
      const marked = segmentText(TEXT, [c(20, 35, 'check')], pageStarts).filter((s) => s.level);
      expect(marked).toEqual([
        {
          start: 20,
          end: 27,
          text: TEXT.slice(20, 27),
          level: 'check',
          clauseIndexes: [0],
          page: 1,
        },
        {
          start: 27,
          end: 35,
          text: TEXT.slice(27, 35),
          level: 'check',
          clauseIndexes: [0],
          page: 2,
        },
      ]);
    });

    it('ignores page starts outside the text', () => {
      const segments = segmentText(TEXT, [], [0, 66, 500]);
      expect(segments).toHaveLength(1);
      expect(segments[0]?.page).toBe(1);
    });

    it('treats a missing first page start as page 1', () => {
      expect(segmentText(TEXT, [], [30]).map((s) => s.page)).toEqual([1, 1]);
    });

    it('still covers the full text with page starts', () => {
      const segments = segmentText(TEXT, [c(32, 52, 'check'), c(48, 65, 'critical')], pageStarts);
      expect(joined(segments)).toBe(TEXT);
      segments.forEach((s, i) => {
        if (i > 0) expect(s.start).toBe(segments[i - 1]?.end);
      });
    });
  });

  describe('pageAt', () => {
    it('returns 1 without page starts', () => {
      expect(pageAt(40)).toBe(1);
    });

    it('returns the 1-based page of an offset', () => {
      expect(pageAt(0, [0, 27, 48])).toBe(1);
      expect(pageAt(26, [0, 27, 48])).toBe(1);
      expect(pageAt(27, [0, 27, 48])).toBe(2);
      expect(pageAt(65, [0, 27, 48])).toBe(3);
    });
  });
});
