import { z } from 'zod';

// ─────────────────────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────────────────────

const frequencySchema = z.enum(['m5', 'm15', 'm30']);

// ─────────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────────

export const createMonitorSchema = z.object({
  configId: z.string().uuid('configId debe ser UUID'),

  // Nombre del monitor (el que ve el usuario)
  name: z
    .string()
    .trim()
    .min(1, 'El nombre es requerido')
    .max(255, 'Nombre demasiado largo'),

  // Frecuencia de monitoreo
  frequencyMin: frequencySchema.default('m30'),

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
  frequencyMin: frequencySchema.optional(),
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