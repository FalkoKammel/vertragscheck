import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import type { ContractSummary, GradeResult, Ratio, Summary } from './grade';
import type { Contract } from './load';
import { EVAL_DOC, RESULTS_DIR, SUMMARY_FILE } from './paths';
import type { ResultsFile } from './results.schema';

type Meta = ResultsFile['meta'];

export function pct(r: Ratio): string {
  return r.den === 0
    ? '–'
    : `${String(Math.round((r.num / r.den) * 100))} % (${String(r.num)}/${String(r.den)})`;
}

function pctRange(r: Summary['recall']): string {
  if (r.den === 0) return '–';
  const p = (v: number) => String(Math.round(v * 100));
  return `${p(r.mean)} % (min ${p(r.min)}, max ${p(r.max)}; ${String(r.num)}/${String(r.den)})`;
}

function usd(micro: number): string {
  return `$${(micro / 1_000_000).toFixed(4)}`;
}

export function summaryRows(s: Summary): [string, string][] {
  return [
    ['Recall (all labels)', pctRange(s.recall)],
    ['Recall critical', pctRange(s.recallCritical)],
    ['Recall check', pctRange(s.recallCheck)],
    ['Missed: seen but rated fine', String(s.missedSeenAsFine)],
    ['Missed: not hit at all', String(s.missedNotHit)],
    ['Consistency (found in every run)', pct(s.consistency)],
    ['Level accuracy (found labels)', pct(s.levelAccuracy)],
    ['Category accuracy (found labels)', pct(s.categoryAccuracy)],
    ['False alarms (clean labels)', pct(s.falseAlarmRate)],
    ['Overcautious (clean labels)', pct(s.overcautiousRate)],
    ['Unverified quotes (of returned clauses)', pct(s.unverifiedQuotes)],
    ['Invalid clauses (of returned clauses)', pct(s.invalidClauses)],
    ['Failed runs', pct(s.failedRuns)],
    [
      'Cost per analysis (mean / total)',
      `${usd(s.costMicroUsd.mean)} / ${usd(s.costMicroUsd.total)}`,
    ],
    [
      'Latency (mean / p95)',
      `${String(Math.round(s.latencyMs.mean))} ms / ${String(Math.round(s.latencyMs.p95))} ms`,
    ],
  ];
}

export function markdownTable(rows: [string, string][]): string {
  return ['| Metric | Value |', '| --- | --- |', ...rows.map(([a, b]) => `| ${a} | ${b} |`)].join(
    '\n',
  );
}

export function contractLines(c: ContractSummary): string[] {
  const lines = [
    `${c.contractId}: recall ${pct(c.recall)}, false alarms ${pct(c.falseAlarmRate)}, overcautious ${pct(c.overcautiousRate)}` +
      (c.failedRuns > 0 ? `, failed runs ${String(c.failedRuns)}` : ''),
  ];
  for (const m of c.missed) {
    lines.push(
      `  missed ${m.id} in ${String(m.runsMissed)}/${String(m.runs)} runs (${m.reasons.map((r) => (r === 'seenAsFine' ? 'seen but rated fine' : 'not hit')).join(', ')})`,
    );
  }
  for (const f of c.falseAlarms) {
    lines.push(`  false alarm in ${String(f.runs)} run(s): ${f.anchor.slice(0, 70)}`);
  }
  return lines;
}

export function printReport(g: GradeResult): void {
  const rows = summaryRows(g.summary);
  const w = Math.max(...rows.map(([a]) => a.length));
  console.log('\nSummary');
  for (const [a, b] of rows) console.log(`  ${a.padEnd(w)}  ${b}`);
  console.log('\nPer contract');
  for (const c of g.contracts) for (const l of contractLines(c)) console.log(l);
}

export function docSection(
  meta: Meta,
  g: GradeResult,
  contracts: Contract[],
  regraded: boolean,
): string {
  const expected = contracts.reduce((n, c) => n + c.expected.length, 0);
  const clean = contracts.reduce((n, c) => n + c.clean.length, 0);
  const lines = [
    `## ${meta.date.slice(0, 10)} · ${meta.model} · prompt ${meta.promptVersion}${regraded ? ' (regraded)' : ''}`,
    '',
    `- Runs per contract: ${String(meta.runs)}`,
    `- Contracts: ${String(contracts.length)}, labels: ${String(expected)} expected + ${String(clean)} clean`,
    `- Commit: ${meta.commit}`,
    '',
    markdownTable(summaryRows(g.summary)),
    '',
    '### Misses and false alarms per contract',
    '',
    ...g.contracts.flatMap((c) =>
      contractLines(c).map((l) => (l.startsWith('  ') ? `  - ${l.trim()}` : `- ${l}`)),
    ),
    '',
  ];
  return lines.join('\n');
}

const summaryEntrySchema = z.object({
  model: z.string(),
  promptVersion: z.string(),
  date: z.string(),
  runs: z.number(),
  contracts: z.number(),
  labels: z.number(),
  summary: z.unknown(),
});
const summaryFileSchema = z.record(z.string(), summaryEntrySchema);

export function writeSummaryJson(meta: Meta, g: GradeResult, contractCount: number): void {
  let current: z.infer<typeof summaryFileSchema> = {};
  if (existsSync(SUMMARY_FILE)) {
    const parsed = summaryFileSchema.safeParse(JSON.parse(readFileSync(SUMMARY_FILE, 'utf8')));
    if (!parsed.success) throw new Error('eval/summary.json does not match the expected format');
    current = parsed.data;
  }
  current[meta.model] = {
    model: meta.model,
    promptVersion: meta.promptVersion,
    date: meta.date,
    runs: meta.runs,
    contracts: contractCount,
    labels: g.labelCount,
    summary: g.summary,
  };
  writeFileSync(SUMMARY_FILE, `${JSON.stringify(current, null, 2)}\n`);
}

export function unmatchedMarkdown(g: GradeResult): string {
  if (g.unmatched.length === 0) return '# Unmatched clauses\n\nNone.\n';
  const blocks = g.unmatched.map(
    (u) =>
      `## ${u.contractId} · run ${String(u.run)} · ${u.category} · ${u.level}\n\n> ${u.quote.replace(/\n/g, '\n> ')}\n\n${u.reason}\n`,
  );
  return `# Unmatched clauses\n\nClauses the model returned that overlap no label. Review by hand: each is either a missing label or a false positive.\n\n${blocks.join('\n')}`;
}

export function gradeAndReport(
  meta: Meta,
  contracts: Contract[],
  g: GradeResult,
  options: { baseName: string; regraded: boolean },
): void {
  printReport(g);
  mkdirSync(dirname(EVAL_DOC), { recursive: true });
  if (!existsSync(EVAL_DOC)) {
    writeFileSync(
      EVAL_DOC,
      '# Evaluation\n\nResults of `pnpm --filter eval eval`, newest last.\n\n',
    );
  }
  appendFileSync(EVAL_DOC, `${docSection(meta, g, contracts, options.regraded)}\n`);
  writeSummaryJson(meta, g, contracts.length);
  const unmatchedFile = join(RESULTS_DIR, `${options.baseName}.unmatched.md`);
  writeFileSync(unmatchedFile, unmatchedMarkdown(g));
  console.log(`\nWrote docs/eval.md, eval/summary.json, ${unmatchedFile}`);
}
