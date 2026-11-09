import { formatProblems, loadContracts } from './load';
import { CONTRACTS_DIR } from './paths';

const { contracts, problems } = loadContracts(CONTRACTS_DIR);
if (problems.length > 0) {
  console.error(
    `${String(problems.length)} problem(s) in contracts/labels:\n${formatProblems(problems)}`,
  );
  process.exit(1);
}
const labels = contracts.reduce((n, c) => n + c.expected.length + c.clean.length, 0);
console.log(`ok: ${String(contracts.length)} contracts, ${String(labels)} labels`);
