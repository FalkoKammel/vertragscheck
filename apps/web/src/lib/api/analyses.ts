import { z } from 'zod';

export const ANALYSIS_STATUSES = ['pending_upload', 'running', 'done', 'failed'] as const;
export const ANALYSIS_STAGES = ['extracting', 'analysing'] as const;
export const FAILURE_REASONS = [
  'BUDGET_EXHAUSTED',
  'INVALID_PDF',
  'TOO_MANY_PAGES',
  'NO_TEXT_LAYER',
  'LLM_INVALID_OUTPUT',
  'INTERNAL',
  'TIMEOUT',
  'UPLOAD_MISSING',
] as const;

const clauseSchema = z.object({
  ref: z.string().optional(),
  category: z.string(),
  level: z.enum(['fine', 'check', 'critical']),
  quote: z.string(),
  reason: z.string(),
  start: z.number().int().nonnegative(),
  end: z.number().int().positive(),
});

export const analysisResponseSchema = z.object({
  id: z.string().min(1),
  status: z.enum(ANALYSIS_STATUSES),
  contractType: z.enum(['rental', 'employment']),
  language: z.enum(['de', 'en']),
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  stage: z.enum(ANALYSIS_STAGES).optional(),
  failureReason: z.enum(FAILURE_REASONS).optional(),
  result: z
    .object({
      text: z.string(),
      clauses: z.array(clauseSchema),
      unverifiedQuotes: z.number().int().nonnegative(),
      invalidClauses: z.number().int().nonnegative(),
      run: z.object({
        modelId: z.string(),
        promptVersion: z.string(),
        costMicroUsd: z.number().int().nonnegative(),
        latencyMs: z.number().nonnegative(),
        inputTokens: z.number().int().nonnegative(),
        outputTokens: z.number().int().nonnegative(),
      }),
    })
    .optional(),
});

export type AnalysisResponse = z.infer<typeof analysisResponseSchema>;
export type AnalysisStatus = AnalysisResponse['status'];
export type AnalysisStage = (typeof ANALYSIS_STAGES)[number];
export type FailureReason = (typeof FAILURE_REASONS)[number];
export type Clause = NonNullable<AnalysisResponse['result']>['clauses'][number];
