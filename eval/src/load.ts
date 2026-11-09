import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ContractText } from 'api/src/domain/ContractText';
import { EMPLOYMENT_CATEGORY_IDS, RENTAL_CATEGORY_IDS } from 'api/src/domain/categories';
import { labelsFileSchema, type LabelsFile } from './labels.schema';

export interface Span {
  start: number;
  end: number;
}

export type Level = 'check' | 'critical';

export interface ExpectedLabel extends Span {
  id: string;
  anchor: string;
  category: string;
  level: Level;
  acceptLevels: Level[];
  note: string;
}

export interface CleanLabel extends Span {
  anchor: string;
  note?: string;
}

export interface Contract {
  id: string;
  contractType: LabelsFile['contractType'];
  description: string;
  text: ContractText;
  expected: ExpectedLabel[];
  clean: CleanLabel[];
}

export interface LoadProblem {
  file: string;
  anchor?: string;
  reason: string;
}

export interface LoadResult {
  contracts: Contract[];
  problems: LoadProblem[];
}

const TXT = '.txt';
const LABELS = '.labels.json';

function findSpan(text: string, anchor: string): Span | string {
  const start = text.indexOf(anchor);
  if (start === -1) return 'anchor not found in text';
  let count = 1;
  for (let i = text.indexOf(anchor, start + 1); i !== -1; i = text.indexOf(anchor, i + 1)) count++;
  if (count > 1) return `anchor found ${String(count)} times, must be unique`;
  return { start, end: start + anchor.length };
}

export function loadContracts(dir: string, options: { only?: string } = {}): LoadResult {
  const problems: LoadProblem[] = [];
  const contracts: Contract[] = [];
  const files = readdirSync(dir);
  const ids = new Set<string>();
  for (const f of files) {
    if (f.endsWith(LABELS)) ids.add(f.slice(0, -LABELS.length));
    else if (f.endsWith(TXT)) ids.add(f.slice(0, -TXT.length));
  }
  const seenLabelIds = new Map<string, string>();

  for (const id of [...ids].sort()) {
    if (options.only !== undefined && !id.startsWith(options.only)) continue;
    const txtName = id + TXT;
    const labelsName = id + LABELS;
    const hasTxt = files.includes(txtName);
    const hasLabels = files.includes(labelsName);
    if (!hasTxt || !hasLabels) {
      problems.push({
        file: hasTxt ? labelsName : txtName,
        reason: `missing file (the pair ${txtName} + ${labelsName} must exist)`,
      });
      continue;
    }

    let json: unknown;
    try {
      json = JSON.parse(readFileSync(join(dir, labelsName), 'utf8'));
    } catch {
      problems.push({ file: labelsName, reason: 'not valid JSON' });
      continue;
    }
    const parsed = labelsFileSchema.safeParse(json);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        problems.push({
          file: labelsName,
          reason: `${issue.path.join('.') || '(root)'}: ${issue.message}`,
        });
      }
      continue;
    }
    const labels = parsed.data;
    const text = ContractText.fromExtracted([readFileSync(join(dir, txtName), 'utf8')]);
    const validCategories: readonly string[] =
      labels.contractType === 'rental' ? RENTAL_CATEGORY_IDS : EMPLOYMENT_CATEGORY_IDS;
    const before = problems.length;

    const expected: ExpectedLabel[] = [];
    for (const e of labels.expected) {
      if (!validCategories.includes(e.category)) {
        problems.push({
          file: labelsName,
          anchor: e.id,
          reason: `category "${e.category}" is not a ${labels.contractType} category`,
        });
      }
      if (!e.id.startsWith(`${id}-`)) {
        problems.push({ file: labelsName, anchor: e.id, reason: `id must start with "${id}-"` });
      }
      const other = seenLabelIds.get(e.id);
      if (other !== undefined) {
        problems.push({
          file: labelsName,
          anchor: e.id,
          reason: `duplicate id (also in ${other})`,
        });
      }
      seenLabelIds.set(e.id, labelsName);
      const span = findSpan(text.value, e.anchor);
      if (typeof span === 'string') {
        problems.push({ file: labelsName, anchor: e.anchor, reason: span });
        continue;
      }
      expected.push({ ...e, ...span, acceptLevels: e.acceptLevels ?? [] });
    }

    const clean: CleanLabel[] = [];
    for (const c of labels.clean) {
      const span = findSpan(text.value, c.anchor);
      if (typeof span === 'string') {
        problems.push({ file: labelsName, anchor: c.anchor, reason: span });
        continue;
      }
      clean.push({ ...c, ...span });
    }

    if (problems.length === before) {
      contracts.push({
        id,
        contractType: labels.contractType,
        description: labels.description,
        text,
        expected,
        clean,
      });
    }
  }
  return { contracts, problems };
}

export function formatProblems(problems: LoadProblem[]): string {
  return problems
    .map((p) => `  ${p.file}${p.anchor ? ` [${p.anchor.slice(0, 60)}]` : ''}: ${p.reason}`)
    .join('\n');
}
