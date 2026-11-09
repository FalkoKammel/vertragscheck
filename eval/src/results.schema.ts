import { storedClauseSchema } from 'api/src/domain/schemas';
import { z } from 'zod';

const usageSchema = z.object({ inputTokens: z.number(), outputTokens: z.number() });

const llmClauseRecordSchema = z.object({
  ref: z.string().optional(),
  category: z.string(),
  level: z.enum(['fine', 'check', 'critical']),
  quote: z.string(),
  reason: z.string(),
});

const baseResult = {
  modelId: z.string(),
  promptVersion: z.string(),
  usage: usageSchema,
  latencyMs: z.number(),
};

const resultSchema = z.discriminatedUnion('ok', [
  z.object({
    ...baseResult,
    ok: z.literal(true),
    clauses: z.array(llmClauseRecordSchema),
    invalidClauses: z.number().int(),
  }),
  z.object({ ...baseResult, ok: z.literal(false) }),
]);

export const callRecordSchema = z.object({
  contractId: z.string(),
  run: z.number().int(),
  result: resultSchema.optional(),
  verification: z
    .object({ clauses: z.array(storedClauseSchema), unverifiedQuotes: z.number().int() })
    .optional(),
  costMicroUsd: z.number().optional(),
  wallMs: z.number().optional(),
  error: z.string().optional(),
});

export const resultsFileSchema = z.object({
  meta: z.object({
    model: z.string(),
    promptVersion: z.string(),
    runs: z.number().int(),
    date: z.string(),
    commit: z.string(),
    contractIds: z.array(z.string()),
  }),
  calls: z.array(callRecordSchema),
});

export type CallRecord = z.infer<typeof callRecordSchema>;
export type ResultsFile = z.infer<typeof resultsFileSchema>;
