import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { grade } from './grade';
import { formatProblems, loadContracts } from './load';
import { CONTRACTS_DIR } from './paths';
import { gradeAndReport } from './report';
import { resultsFileSchema } from './results.schema';

const arg = process.argv[2];
if (!arg) {
  console.error('Usage: pnpm --filter eval eval:grade <path to eval/results/*.json>');
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
gradeAndReport(meta, graded, grade(graded, calls), {
  baseName: basename(path, '.json'),
  regraded: true,
});
