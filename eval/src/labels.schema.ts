import { z } from 'zod';

const levelSchema = z.enum(['check', 'critical']);

export const expectedLabelSchema = z.object({
  id: z.string().regex(/^[a-z]+-\d{2}-[a-z0-9-]+$/),
  anchor: z.string().min(15),
  category: z.string(),
  level: levelSchema,
  acceptLevels: z.array(levelSchema).optional(),
  note: z.string().min(1),
});

export const cleanLabelSchema = z.object({
  anchor: z.string().min(15),
  note: z.string().optional(),
});

export const labelsFileSchema = z.object({
  contractType: z.enum(['rental', 'employment']),
  description: z.string(),
  expected: z.array(expectedLabelSchema),
  clean: z.array(cleanLabelSchema),
});

export type LabelsFile = z.infer<typeof labelsFileSchema>;
