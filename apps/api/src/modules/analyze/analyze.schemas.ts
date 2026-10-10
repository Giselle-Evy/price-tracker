import { z } from 'zod';

export const analyzeSchema = z.object({
  url: z
    .string()
    .trim()
    .url('Debe ser una URL válida')
    .max(2048, 'La URL es demasiado larga'),
});

export type AnalyzeInput = z.infer<typeof analyzeSchema>;