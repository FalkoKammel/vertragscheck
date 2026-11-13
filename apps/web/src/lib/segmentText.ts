import type { Clause } from '@/lib/api/analyses';

export type Level = Clause['level'];

export interface Segment {
  start: number;
  end: number;
  text: string;
  level?: Level;
  clauseIndexes: number[];
  page: number;
}

export const SEVERITY: Record<Level, number> = { fine: 0, check: 1, critical: 2 };

/** 1-based page of a character offset. Without page starts everything is on page 1. */
export function pageAt(offset: number, pageStarts?: number[]): number {
  if (!pageStarts) return 1;
  const passed = pageStarts.filter((start) => start <= offset).length;
  return Math.max(1, passed);
}

/**
 * Splits the text at every clause and page boundary. The segments cover the text without gaps
 * or overlaps. Overlapping clauses are not merged: each segment lists all clauses covering it.
 */
export function segmentText(text: string, clauses: Clause[], pageStarts?: number[]): Segment[] {
  if (text.length === 0) return [];

  const valid = clauses
    .map((clause, index) => ({ clause, index }))
    .filter(({ clause }) => clause.start < clause.end && clause.end <= text.length);

  const boundaries = new Set<number>([0, text.length]);
  for (const { clause } of valid) {
    boundaries.add(clause.start);
    boundaries.add(clause.end);
  }
  for (const start of pageStarts ?? []) {
    if (start > 0 && start < text.length) boundaries.add(start);
  }
  const points = [...boundaries].sort((a, b) => a - b);

  const segments: Segment[] = [];
  for (const [i, start] of points.entries()) {
    const end = points[i + 1];
    if (end === undefined) break;
    const covering = valid.filter(({ clause }) => clause.start <= start && clause.end >= end);

    const segment: Segment = {
      start,
      end,
      text: text.slice(start, end),
      clauseIndexes: covering.map(({ index }) => index),
      page: pageAt(start, pageStarts),
    };
    const top = covering.reduce<Level | undefined>(
      (best, { clause }) =>
        best === undefined || SEVERITY[clause.level] > SEVERITY[best] ? clause.level : best,
      undefined,
    );
    if (top) segment.level = top;
    segments.push(segment);
  }
  return segments;
}
