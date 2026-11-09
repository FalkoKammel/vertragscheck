import { describe, expect, it } from 'vitest';
import { labelsFileSchema } from './labels.schema';

const valid = {
  contractType: 'rental',
  description: 'test',
  expected: [
    {
      id: 'rental-01-minor-repairs',
      anchor: 'a long enough anchor text',
      category: 'minor_repairs',
      level: 'critical',
      note: 'why',
    },
  ],
  clean: [{ anchor: 'another long enough anchor' }],
};

describe('labelsFileSchema', () => {
  it('accepts a valid file', () => {
    expect(labelsFileSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects a typo in the level', () => {
    const bad = { ...valid, expected: [{ ...valid.expected[0], level: 'critcal' }] };
    expect(labelsFileSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a missing note', () => {
    const noNote = { ...valid.expected[0], note: undefined };
    expect(labelsFileSchema.safeParse({ ...valid, expected: [noNote] }).success).toBe(false);
  });

  it('rejects a malformed id and a short anchor', () => {
    const badId = { ...valid, expected: [{ ...valid.expected[0], id: 'Rental_1' }] };
    const shortAnchor = { ...valid, clean: [{ anchor: 'short' }] };
    expect(labelsFileSchema.safeParse(badId).success).toBe(false);
    expect(labelsFileSchema.safeParse(shortAnchor).success).toBe(false);
  });
});
