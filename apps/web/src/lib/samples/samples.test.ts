import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { analysisResponseSchema } from '../api/analyses';
import { SAMPLE_IDS } from '../api/getSample';

const DIR = join(import.meta.dirname, '..', '..', '..', 'public', 'samples');
const files = existsSync(DIR)
  ? readdirSync(DIR).filter((f) => /^sample-.+\.(de|en)\.json$/.test(f))
  : [];

// The files come from `pnpm --filter eval samples`. Until they are generated and committed, there is
// nothing to check; once they exist, every one must be a valid done response.
describe.skipIf(files.length === 0)('generated sample analyses', () => {
  it.each(files)('%s is a valid done response', (file) => {
    const json: unknown = JSON.parse(readFileSync(join(DIR, file), 'utf8'));
    const parsed = analysisResponseSchema.parse(json);
    const [id, language] = file.replace(/\.json$/, '').split(/\.(?=de$|en$)/);

    expect(parsed.id).toBe(id);
    expect(parsed.language).toBe(language);
    expect(parsed.status).toBe('done');
    expect(SAMPLE_IDS as readonly string[]).toContain(parsed.id);
    expect(JSON.stringify(json)).not.toMatch(/delete/i);

    const result = parsed.result;
    expect(result).toBeDefined();
    for (const clause of result?.clauses ?? []) {
      expect(clause.end).toBeLessThanOrEqual(result?.text.length ?? 0);
      expect(clause.start).toBeLessThan(clause.end);
    }
  });

  it('has a manifest entry for every file', () => {
    const manifest = JSON.parse(readFileSync(join(DIR, 'manifest.json'), 'utf8')) as {
      files: Record<string, unknown>;
    };
    expect(Object.keys(manifest.files).sort()).toEqual([...files].sort());
  });
});
