import { z } from 'zod';

// ─────────────────────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────────────────────

const createFrequencySchema = z.enum(['m5', 'm15', 'm30']);
const managedFrequencySchema = z.enum(['m5', 'm10', 'm15', 'm30']);

// ─────────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────────

export const createMonitorSchema = z.object({
  productId: z.string().uuid('productId debe ser UUID'),
  configId: z.string().uuid('configId debe ser UUID').optional(),

  // Nombre del monitor (el que ve el usuario)
  name: z
    .string()
    .trim()
    .min(1, 'El nombre es requerido')
    .max(255, 'Nombre demasiado largo'),

  // Frecuencia de monitoreo
  frequencyMin: createFrequencySchema.default('m15'),
  durationDays: z
    .union([z.literal(5), z.literal(10), z.literal(15)])
    .optional(),

  // Alertas opcionales
  alertOnDrop: z.boolean().default(true),
  alertEnabled: z.boolean().default(true),

  // Precio objetivo opcional
  targetPrice: z.number().positive().optional(),
});

export type CreateMonitorInput = z.infer<typeof createMonitorSchema>;

// ─────────────────────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────────────────────

export const updateMonitorSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  frequencyMin: managedFrequencySchema.optional(),
  status: z.enum(['active', 'paused']).optional(),
  alertOnDrop: z.boolean().optional(),
  alertEnabled: z.boolean().optional(),
  targetPrice: z.number().positive().nullable().optional(),
});

export type UpdateMonitorInput = z.infer<typeof updateMonitorSchema>;

// ─────────────────────────────────────────────────────────────
// PARAMS
// ─────────────────────────────────────────────────────────────

export const monitorIdParamSchema = z.object({
  id: z.string().uuid('id debe ser UUID'),
});

export type MonitorIdParam = z.infer<typeof monitorIdParamSchema>;