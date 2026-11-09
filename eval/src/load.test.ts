import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadContracts } from './load';

const TEXT =
  'Erster Absatz mit einer eindeutigen Stelle.\n\nZweiter Absatz, Wiederholung Wiederholung hier und Wiederholung hier.';

function labels(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    contractType: 'rental',
    description: 'd',
    expected: [
      {
        id: 'rental-01-unique',
        anchor: 'einer eindeutigen Stelle',
        category: 'rent',
        level: 'check',
        note: 'n',
      },
    ],
    clean: [],
    ...overrides,
  });
}

describe('loadContracts', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'eval-load-'));
    writeFileSync(join(dir, 'rental-01.txt'), TEXT);
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('loads a valid pair with the anchor span', () => {
    writeFileSync(join(dir, 'rental-01.labels.json'), labels());
    const { contracts, problems } = loadContracts(dir);
    expect(problems).toEqual([]);
    const contract = contracts[0];
    const label = contract?.expected[0];
    expect(contract).toBeDefined();
    expect(label).toBeDefined();
    expect(contract?.text.value.slice(label?.start, label?.end)).toBe('einer eindeutigen Stelle');
  });

  it('reports an anchor that is not found', () => {
    writeFileSync(
      join(dir, 'rental-01.labels.json'),
      labels({ clean: [{ anchor: 'diese Stelle gibt es nicht' }] }),
    );
    const { contracts, problems } = loadContracts(dir);
    expect(contracts).toEqual([]);
    expect(problems[0]?.reason).toContain('not found');
  });

  it('reports an anchor that occurs twice', () => {
    writeFileSync(
      join(dir, 'rental-01.labels.json'),
      labels({ clean: [{ anchor: 'Wiederholung hier' }] }),
    );
    const { problems } = loadContracts(dir);
    expect(problems[0]?.reason).toContain('2 times');
  });

  it('reports a missing label file', () => {
    const { problems } = loadContracts(dir);
    expect(problems).toEqual([
      expect.objectContaining({
        file: 'rental-01.labels.json',
        reason: expect.stringContaining('missing') as string,
      }),
    ]);
  });

  it('reports an unknown category and an id with the wrong prefix', () => {
    writeFileSync(
      join(dir, 'rental-01.labels.json'),
      labels({
        expected: [
          {
            id: 'rental-02-wrong',
            anchor: 'einer eindeutigen Stelle',
            category: 'probation',
            level: 'check',
            note: 'n',
          },
        ],
      }),
    );
    const reasons = loadContracts(dir).problems.map((p) => p.reason);
    expect(reasons.some((r) => r.includes('not a rental category'))).toBe(true);
    expect(reasons.some((r) => r.includes('must start with'))).toBe(true);
  });
});
