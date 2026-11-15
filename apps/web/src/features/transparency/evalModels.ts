import { z } from 'zod';
import summaryFile from '../../../../../eval/summary.json';

const ratio = z.object({ num: z.number(), den: z.number() });

const entrySchema = z.object({
  model: z.string(),
  promptVersion: z.string(),
  runs: z.number().int().positive(),
  contracts: z.number().int().positive(),
  summary: z.object({
    recall: ratio,
    falseAlarmRate: ratio,
    costMicroUsd: z.object({ mean: z.number() }),
    latencyMs: z.object({ p95: z.number() }),
  }),
});

export interface ModelRow {
  modelId: string;
  promptVersion: string;
  found: { num: number; den: number };
  falseAlarms: { num: number; den: number };
  meanCostMicroUsd: number;
  p95LatencyMs: number;
}

export interface ModelComparison {
  rows: ModelRow[];
  contracts: number;
}

export function buildModelComparison(file: unknown): ModelComparison {
  const entries = z.record(z.string(), entrySchema).parse(file);
  const rows = Object.entries(entries)
    .filter(([key, entry]) => key === entry.model)
    .map(([, entry]): ModelRow => {
      const { runs, summary } = entry;
      return {
        modelId: entry.model,
        promptVersion: entry.promptVersion,
        found: { num: summary.recall.num / runs, den: summary.recall.den / runs },
        falseAlarms: {
          num: summary.falseAlarmRate.num / runs,
          den: summary.falseAlarmRate.den / runs,
        },
        meanCostMicroUsd: summary.costMicroUsd.mean,
        p95LatencyMs: summary.latencyMs.p95,
      };
    });
  const contracts = Math.max(0, ...Object.values(entries).map((e) => e.contracts));
  return { rows, contracts };
}

export const modelComparison = buildModelComparison(summaryFile);
