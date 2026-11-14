import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import { BedrockAnalyser } from 'api/src/adapters/BedrockAnalyser';
import { PROMPT_VERSION } from 'api/src/application/prompts/buildSystemPrompt';
import { LANGUAGES } from 'api/src/domain/analysis';
import { z } from 'zod';
import { grade } from './grade';
import { formatProblems, loadContracts, type Contract } from './load';
import { CONTRACTS_DIR, SAMPLE_CONTRACTS_DIR, SAMPLES_OUT_DIR } from './paths';
import { pct } from './report';
import { buildSampleResponse } from './sampleResponse';
import type { CallRecord } from './results.schema';

// Mirrors DEFAULT_MODEL_ID in infra/lib/constructs/analysis.ts, the value the deployed Lambda
// gets as MODEL_ID. Set MODEL_ID in the environment to override.
const PRODUCTION_MODEL_ID = 'eu.anthropic.claude-sonnet-4-6';

export const SAMPLES = [
  { id: 'sample-rental', contractId: 'rental-02', dir: CONTRACTS_DIR },
  { id: 'sample-employment', contractId: 'sample-employment-en', dir: SAMPLE_CONTRACTS_DIR },
] as const;

export const manifestSchema = z.object({
  files: z.record(
    z.string(),
    z.object({
      model: z.string(),
      promptVersion: z.string(),
      commit: z.string(),
      date: z.string(),
    }),
  ),
});
export type Manifest = z.infer<typeof manifestSchema>;

function readManifest(file: string): Manifest {
  if (!existsSync(file)) return { files: {} };
  const parsed = manifestSchema.safeParse(JSON.parse(readFileSync(file, 'utf8')));
  return parsed.success ? parsed.data : { files: {} };
}

function git(...args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function loadSampleContracts(): Contract[] {
  const contracts: Contract[] = [];
  for (const dir of new Set(SAMPLES.map((s) => s.dir))) {
    const { contracts: loaded, problems } = loadContracts(dir);
    if (problems.length > 0) {
      console.error(`${String(problems.length)} problem(s):\n${formatProblems(problems)}`);
      process.exit(1);
    }
    contracts.push(...loaded);
  }
  return contracts;
}

async function main(): Promise<void> {
  const model = process.env.MODEL_ID ?? PRODUCTION_MODEL_ID;
  const all = loadSampleContracts();
  if (git('status', '--porcelain').length > 0) {
    console.warn(
      'Warning: working tree has uncommitted changes, the recorded commit is not exact.',
    );
  }
  const commit = git('rev-parse', 'HEAD');
  console.log(`Model ${model}, prompt ${PROMPT_VERSION}, one call per sample and language`);

  const analyser = new BedrockAnalyser(new BedrockRuntimeClient({ region: 'eu-central-1' }), model);
  mkdirSync(SAMPLES_OUT_DIR, { recursive: true });
  const manifestFile = join(SAMPLES_OUT_DIR, 'manifest.json');
  const manifest = readManifest(manifestFile);
  const rows: string[] = [];
  let failures = 0;

  for (const sample of SAMPLES) {
    const contract = all.find((c) => c.id === sample.contractId);
    if (!contract) throw new Error(`contract ${sample.contractId} not found`);
    for (const language of LANGUAGES) {
      const label = `${sample.id}.${language}`;
      // Exactly one call, no retry and no re-roll: the file shows what a single run returns.
      const result = await analyser.analyse({
        contractType: contract.contractType,
        language,
        text: contract.text.value,
      });
      if (!result.ok) {
        console.error(`${label}: model call failed (${result.reason}), nothing written`);
        failures++;
        continue;
      }
      const response = buildSampleResponse({
        sampleId: sample.id,
        contractType: contract.contractType,
        language,
        text: contract.text,
        result,
      });
      if (response.result === undefined || response.result.clauses.length === 0) {
        // same condition that fails an analysis in production
        console.error(`${label}: no clause survived quote verification, nothing written`);
        failures++;
        continue;
      }

      const fileName = `${label}.json`;
      writeFileSync(join(SAMPLES_OUT_DIR, fileName), `${JSON.stringify(response, null, 2)}\n`);
      manifest.files[fileName] = {
        model,
        promptVersion: PROMPT_VERSION,
        commit,
        date: new Date().toISOString(),
      };
      console.log(`${label}: written, $${(response.result.run.costMicroUsd / 1e6).toFixed(4)}`);

      // Grading only: nothing goes to docs/eval.md or eval/summary.json.
      const call: CallRecord = {
        contractId: contract.id,
        run: 1,
        result,
        verification: {
          clauses: response.result.clauses,
          unverifiedQuotes: response.result.unverifiedQuotes,
        },
      };
      const { summary, contracts } = grade([contract], [call]);
      const missed = contracts[0]?.missed.map((m) => m.id) ?? [];
      rows.push(
        `${sample.id} ${language}: recall ${pct(summary.recall)}, false alarms ${pct(summary.falseAlarmRate)}, overcautious ${pct(summary.overcautiousRate)}` +
          (missed.length > 0 ? `, missed: ${missed.join(', ')}` : ''),
      );
    }
  }

  const sorted = Object.fromEntries(
    Object.entries(manifest.files).sort(([a], [b]) => a.localeCompare(b)),
  );
  writeFileSync(manifestFile, `${JSON.stringify({ files: sorted }, null, 2)}\n`);
  console.log(
    `\nGrading against the labels (${String(new Set(SAMPLES.map((s) => s.contractId)).size)} contracts):`,
  );
  for (const row of rows) console.log(`  ${row}`);
  if (failures > 0) {
    console.error(`${String(failures)} sample(s) failed`);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1] ?? ''}`) {
  await main();
}
