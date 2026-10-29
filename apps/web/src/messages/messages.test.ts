import { describe, expect, it } from 'vitest';
import de from './de.json';
import en from './en.json';

function flatten(value: unknown, prefix = ''): Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return { [prefix]: value };
  return Object.entries(value).reduce<Record<string, unknown>>(
    (acc, [key, child]) => ({ ...acc, ...flatten(child, prefix ? `${prefix}.${key}` : key) }),
    {},
  );
}

describe('message files', () => {
  const flatDe = flatten(de);
  const flatEn = flatten(en);

  it('define the same keys in German and English', () => {
    expect(Object.keys(flatEn).sort()).toEqual(Object.keys(flatDe).sort());
  });

  it('contain no empty strings', () => {
    for (const [key, value] of [...Object.entries(flatDe), ...Object.entries(flatEn)]) {
      expect(typeof value === 'string' && value.trim() !== '', key).toBe(true);
    }
  });
});
