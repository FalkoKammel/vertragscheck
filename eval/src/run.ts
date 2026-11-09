import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import { BedrockAnalyser } from 'api/src/adapters/BedrockAnalyser';
import { PROMPT_VERSION } from 'api/src/application/prompts/buildSystemPrompt';
import { calculateCostMicroUsd, MODEL_PRICES } from 'api/src/domain/pricing';
import { grade } from './grade';
import { formatProblems, loadContracts } from './load';
import { CONTRACTS_DIR, RESULTS_DIR } from './paths';
import { gradeAndReport } from './report';
import { withRetry } from './retry';
import type { CallRecord, ResultsFile } from './results.schema';

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 30_000;

export function modelShortName(model: string): string {
  const last = model.split('.').pop() ?? model;
  return last.replace(/-\d{8}-v\d+:\d+$/, '').replace(/[^a-zA-Z0-9-]/g, '-');
}

export function resultsBaseName(date: Date, promptVersion: string, model: string): string {
  const iso = date.toISOString();
  return `${iso.slice(0, 10)}T${iso.slice(11, 13)}${iso.slice(14, 16)}-${promptVersion}-${modelShortName(model)}`;
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      model: { type: 'string' },
      runs: { type: 'string', default: '3' },
      only: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
    },
  });
  const model = values.model;
  if (!model) {
    console.error('Missing --model <bedrock model or inference profile id>');
    process.exit(1);
  }
  const runs = Number(values.runs);
  if (!Number.isInteger(runs) || runs < 1) {
    console.error('--runs must be a positive integer');
    process.exit(1);
  }

  const { contracts, problems } = loadContracts(CONTRACTS_DIR, { only: values.only });
  if (problems.length > 0) {
    console.error(
      `${String(problems.length)} problem(s), nothing sent to Bedrock:\n${formatProblems(problems)}`,
    );
    process.exit(1);
  }
  if (contracts.length === 0) {
    console.error('No contracts selected');
    process.exit(1);
  }
  if (!(model in MODEL_PRICES)) {
    console.error(
      `No price entry for ${model} in services/api/src/domain/pricing.ts. Add the verified price there first; the eval does not guess prices.`,
    );
    process.exit(1);
  }

  const total = contracts.length * runs;
  if (values['dry-run']) {
    console.log(
      `Dry run: ${String(contracts.length)} contracts × ${String(runs)} runs = ${String(total)} calls with ${model}, prompt ${PROMPT_VERSION}`,
    );
    console.log(`Contracts: ${contracts.map((c) => c.id).join(', ')}`);
    return;
  }

  const analyser = new BedrockAnalyser(new BedrockRuntimeClient({ region: 'eu-central-1' }), model);
  const calls: CallRecord[] = [];
  let n = 0;
  for (let run = 1; run <= runs; run++) {
    for (const contract of contracts) {
      n++;
      const started = Date.now();
      const label = `[${String(n)}/${String(total)}] ${contract.id} run ${String(run)}`;
      try {
        const result = await withRetry(
          () =>
            analyser.analyse({
              contractType: contract.contractType,
              language: 'de',
              text: contract.text.value,
            }),
          {
            attempts: MAX_ATTEMPTS,
            delayMs: RETRY_DELAY_MS,
            onRetry: (attempt, e) => {
              const first = (e instanceof Error ? e.message : 'unknown error').split('\n')[0] ?? '';
              console.log(
                `${label}: attempt ${String(attempt)} failed (${first.slice(0, 80)}), retrying in ${String(RETRY_DELAY_MS / 1000)} s`,
              );
            },
          },
        );
        const costMicroUsd = calculateCostMicroUsd(model, result.usage);
        const verification = result.ok ? contract.text.verifyQuotes(result.clauses) : undefined;
        calls.push({
          contractId: contract.id,
          run,
          result,
          ...(verification ? { verification } : {}),
          costMicroUsd,
          wallMs: Date.now() - started,
        });
        console.log(
          `${label}: ok=${String(result.ok)} ${String(result.latencyMs)} ms $${(costMicroUsd / 1e6).toFixed(4)}`,
        );
      } catch (e) {
        const error = e instanceof Error ? `${e.name}: ${e.message}` : 'unknown error';
        calls.push({ contractId: contract.id, run, error, wallMs: Date.now() - started });
        console.log(`${label}: ERROR ${error.split('\n')[0] ?? ''}`);
        if (n === 1) {
          console.error('First call failed after retries. Stopping, nothing written.');
          process.exit(1);
        }
      }
    }
  }

  if (calls.every((c) => c.error !== undefined)) {
    console.error('Every call failed. Nothing written.');
    process.exit(1);
  }

  const now = new Date();
  const baseName = resultsBaseName(now, PROMPT_VERSION, model);
  const meta: ResultsFile['meta'] = {
    model,
    promptVersion: PROMPT_VERSION,
    runs,
    date: now.toISOString(),
    commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    contractIds: contracts.map((c) => c.id),
  };
  mkdirSync(RESULTS_DIR, { recursive: true });
  const file: ResultsFile = { meta, calls };
  writeFileSync(join(RESULTS_DIR, `${baseName}.json`), `${JSON.stringify(file, null, 2)}\n`);
  gradeAndReport(meta, contracts, grade(contracts, calls), { baseName, regraded: false });
}

if (import.meta.url === `file://${process.argv[1] ?? ''}`) {
  await main();
}
