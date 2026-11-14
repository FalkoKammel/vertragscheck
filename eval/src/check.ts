import { formatProblems, loadContracts } from './load';
import { CONTRACTS_DIR, SAMPLE_CONTRACTS_DIR } from './paths';

let failed = false;
for (const [name, dir] of [
  ['contracts', CONTRACTS_DIR],
  ['sample-contracts', SAMPLE_CONTRACTS_DIR],
] as const) {
  const { contracts, problems } = loadContracts(dir);
  if (problems.length > 0) {
    console.error(
      `${String(problems.length)} problem(s) in ${name}/labels:\n${formatProblems(problems)}`,
    );
    failed = true;
    continue;
  }
  const labels = contracts.reduce((n, c) => n + c.expected.length + c.clean.length, 0);
  console.log(`ok ${name}: ${String(contracts.length)} contracts, ${String(labels)} labels`);
}
if (failed) process.exit(1);
