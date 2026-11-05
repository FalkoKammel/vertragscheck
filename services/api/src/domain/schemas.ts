import { z } from 'zod';
import { RENTAL_CATEGORY_IDS, EMPLOYMENT_CATEGORY_IDS } from './categories';

export const severityLevelSchema = z.enum(['fine', 'check', 'critical']);
export type SeverityLevel = z.infer<typeof severityLevelSchema>;

function llmClauseSchema<T extends readonly [string, ...string[]]>(categoryIds: T) {
  return z.object({
    ref: z.string().optional(),
    category: z.enum(categoryIds),
    level: severityLevelSchema,
    quote: z.string().min(1),
    reason: z.string().min(1),
  });
}

export const rentalLlmClauseSchema = llmClauseSchema(RENTAL_CATEGORY_IDS);
export const employmentLlmClauseSchema = llmClauseSchema(EMPLOYMENT_CATEGORY_IDS);

export const storedClauseSchema = z
  .object({
    ref: z.string().optional(),
    category: z.enum([...RENTAL_CATEGORY_IDS, ...EMPLOYMENT_CATEGORY_IDS]),
    level: severityLevelSchema,
    quote: z.string(),
    reason: z.string(),
    start: z.number().int().nonnegative(),
    end: z.number().int().positive(),
  })
  .refine((c) => c.end > c.start, { message: 'end must be after start' });

export type StoredClause = z.infer<typeof storedClauseSchema>;
export type RentalLlmClause = z.infer<typeof rentalLlmClauseSchema>;
export type EmploymentLlmClause = z.infer<typeof employmentLlmClauseSchema>;
export type LlmClause = RentalLlmClause | EmploymentLlmClause;
