import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { grade } from './grade';
import { formatProblems, loadContracts } from './load';
import { CONTRACTS_DIR } from './paths';
import { gradeAndReport } from './report';
import { resultsFileSchema } from './results.schema';
import { reverifyCalls } from './reverify';

const args = process.argv.slice(2);
const reverify = args.includes('--reverify');
const arg = args.find((a) => !a.startsWith('--'));
if (!arg) {
  console.error('Usage: pnpm --filter eval eval:grade [--reverify] <path to eval/results/*.json>');
  process.exit(1);
}
const path = resolve(process.env.INIT_CWD ?? process.cwd(), arg);
const parsed = resultsFileSchema.safeParse(JSON.parse(readFileSync(path, 'utf8')));
if (!parsed.success) {
  console.error(`${path} does not match the results format:\n${parsed.error.message}`);
  process.exit(1);
}
const { meta, calls } = parsed.data;
const { contracts, problems } = loadContracts(CONTRACTS_DIR);
if (problems.length > 0) {
  console.error(
    `${String(problems.length)} problem(s) in contracts/labels:\n${formatProblems(problems)}`,
  );
  process.exit(1);
}
const graded = contracts.filter((c) => meta.contractIds.includes(c.id));
const baseName = basename(path, '.json');
const gradedCalls = reverify ? reverifyCalls(graded, calls) : calls;
if (reverify) {
  // the original results file stays untouched; the recomputed one gets its own name
  const out = join(dirname(path), `${baseName}-reverified.json`);
  writeFileSync(out, `${JSON.stringify({ meta, calls: gradedCalls }, null, 2)}\n`);
  console.log(`Wrote ${out}`);
}
gradeAndReport(meta, graded, grade(graded, gradedCalls), {
  baseName: reverify ? `${baseName}-reverified` : baseName,
  regraded: true,
  reverified: reverify,
});
