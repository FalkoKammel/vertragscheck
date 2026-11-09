import { describe, expect, it } from 'vitest';
import { pct } from './report';
import { modelShortName, resultsBaseName } from './run';

describe('pct', () => {
  it('rounds to whole numbers and shows counts', () => {
    expect(pct({ num: 41, den: 48 })).toBe('85 % (41/48)');
    expect(pct({ num: 0, den: 0 })).toBe('–');
  });
});

describe('result file naming', () => {
  it('shortens the model id', () => {
    expect(modelShortName('eu.anthropic.claude-haiku-4-5-20251001-v1:0')).toBe('claude-haiku-4-5');
  });
  it('builds the base name', () => {
    expect(
      resultsBaseName(
        new Date('2026-11-09T14:05:00Z'),
        'v1',
        'eu.anthropic.claude-haiku-4-5-20251001-v1:0',
      ),
    ).toBe('2026-11-09T1405-v1-claude-haiku-4-5');
  });
});
